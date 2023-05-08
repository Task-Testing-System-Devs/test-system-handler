const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const {createPool} = require('generic-pool');

let currentUrl;
let functionUrl;

const browserPool = createPool({
    create: async () => {
        const browser = await puppeteer.launch({headless: "new"});
        return browser;
    },
    destroy: async (browser) => {
        await browser.close();
    }
}, {
    min: 2,
    max: 10
});

class Task {
    constructor(probId, timeLimit, realTimeLimit, memoryLimit, title, description) {
        this.probId = probId;
        this.timeLimit = timeLimit;
        this.realTimeLimit = realTimeLimit;
        this.memoryLimit = memoryLimit;
        this.title = title;
        this.description = description;
    }
}

const languageExtensions = {
    'c': '2',
    'cpp': '3',
    'py': '23',
    'pl': '14',
    'rb': '21',
    'mk': '25',
    'asm': '50',
    'c_clang': '51',
    'cpp_clang': '52',
    'mk_vg': '54',
    'c32': '57',
    'c_clang32': '61',
    'asm32': '66',
    'gas': '67',
    'custom': '77'
};

let currentPage = null;

async function withPage(action) {
    const browser = await browserPool.acquire();
    try {
        const page = await getPage(browser);
        return await action(page);
    } catch (error) {
        console.error(error);
    } finally {
        await browserPool.release(browser);
    }
}


async function getPage(browser) {
    if (currentPage) {
        return currentPage;
    }
    currentPage = await browser.newPage();
    return currentPage;
}

async function auth(ejudgeLogin, ejudgePassword, contestID) {
    const maxRetries = 15;
    let retries = 0;
    let authenticated = false;

    while (retries < maxRetries && !authenticated) {
        await withPage(async (page) => {
            try {
                await page.goto('http://37.252.0.155/cgi-bin/master');
                await Promise.all([
                    page.waitForSelector('input[name=login]', {timeout: 2000}),
                    page.waitForSelector('input[name=password]', {timeout: 2000}),
                    page.waitForSelector('input[name=contest_id]', {timeout: 2000}),
                    page.waitForSelector('select[name=role]', {timeout: 2000}),
                    page.waitForSelector('input[name=action_2]', {timeout: 2000}),
                ]);
                await page.$eval('input[name=login]', (el, value) => {
                    el.value = value
                }, ejudgeLogin);
                await page.$eval('input[name=password]', (el, value) => {
                    el.value = value
                }, ejudgePassword);
                await page.$eval('input[name=contest_id]', (el, value) => {
                    el.value = value
                }, contestID);
                await page.$eval('select[name=role]', el => el.value = '6');
                await page.click('input[name=action_2]');
                currentUrl = page.url();
                console.log(currentUrl);
                if (currentUrl.includes('SID')) {
                    authenticated = true;
                } else {
                    retries++;
                    console.log(`Retrying authentication (${retries}/${maxRetries})`);
                }
            } catch (error) {
                console.error(error);
                retries++;
                console.log(`Retrying authentication due to error (${retries}/${maxRetries})`);
            }
        });
    }
    if (retries >= maxRetries && !authenticated) {
        throw new Error('Failed to authenticate after multiple retries');
    }
}


async function handleSolution(solutionFileBase64, taskID, language) {
    await withPage(async (page) => {
        const solutionFilePath = path.join(os.tmpdir(), `solution.py`);
        await fs.writeFile(solutionFilePath, Buffer.from(solutionFileBase64, 'base64'));
        functionUrl = currentUrl.replace("&action=2", "") + `&problem=${taskID}&action_206`;
        console.log(functionUrl);
        await page.goto(functionUrl);
        await page.select('select[name="lang_id"]', language);
        const inputUploadHandle = await page.$('input[type="file"]');
        await inputUploadHandle.uploadFile(solutionFilePath);
        await page.click('input[type="submit"][name="action_40"]');
        await page.waitForTimeout(5000);
        await fs.unlink(solutionFilePath);
    });
}

async function getResult() {
    return await withPage(async (page) => {
        await page.goto(currentUrl);

        async function getSubmissionStatus() {
            return await page.$eval('table.b1 > tbody > tr:nth-child(2) > td:nth-child(6)', el => el.textContent.trim());
        }

        async function getFailureDetails() {
            return await page.$eval('table.b1 > tbody > tr:nth-child(2) > td:nth-child(7)', el => el.textContent.trim());
        }

        let error = await getFailureDetails();
        let status = await getSubmissionStatus();
        while (status === 'Compiling...') {
            await new Promise(resolve => setTimeout(resolve, 500));
            await page.reload();
            status = await getSubmissionStatus();
        }
        if (status !== "OK") {
            console.log('Failed at:', error, "test.");
        }
        console.log('Final status:', status);
        return {status, error};
    });
}

async function parseTasks() {
    const tasks = await withPage(async (page) => {
        functionUrl = currentUrl.replace("&action=2", "") + `&problem=1&action_206`;
        console.log(functionUrl);
        await page.goto(functionUrl);
        const tasks = [];
        let currentTask = 1;
        while (true) {
            const probId = await page.$eval("table:nth-of-type(2) tr:nth-child(1) td:nth-child(2)", (el) => el.innerText);
            const timeLimit = await page.$eval("table:nth-of-type(2) tr:nth-child(2) td:nth-child(2)", (el) => el.innerText);
            const realTimeLimit = await page.$eval("table:nth-of-type(2) tr:nth-child(3) td:nth-child(2)", (el) => el.innerText);
            const memoryLimit = await page.$eval("table:nth-of-type(2) tr:nth-child(4) td:nth-child(2)", (el) => el.innerText);
            const title = await page.$eval("h3", (el) => el.innerText);
            const description = await page.$eval("h3 + p", (el) => el.innerText);
            const task = new Task(probId, timeLimit, realTimeLimit, memoryLimit, title, description);
            tasks.push(task);
            currentTask++;
            const nextProblemButton = await page.$(`a[href*="action=206&problem=${currentTask}"]`);
            if (nextProblemButton) {
                await Promise.all([
                    page.waitForNavigation(),
                    nextProblemButton.click()
                ]);
            } else {
                break;
            }
        }
        return tasks;
    });
    return tasks;
}

module.exports = {
    auth,
    handleSolution,
    getResult,
    parseTasks,
    currentUrl,
    functionUrl,
};