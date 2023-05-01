const puppeteer = require('puppeteer');
const fs = require('fs');

const path = require('path');
const os = require('os');
const solutionFilePath = 'solutions/'
let browser;
let browserIsOpen;
let currentUrl;
let functionUrl;
let taskID;
let fileExtension = solutionFilePath.split('.').pop();
let contestID = 1;
let ejudgeLogin = 'ejudge';
let ejudgePassword = 'ejudge';
let tasks = []

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



async function auth(ejudgeLogin, ejudgePassword, contestID) {
    if (browserIsOpen) {
        await browser.close();
    }
    browser = await puppeteer.launch();
    browserIsOpen = true;
    const page = await browser.newPage();
    await page.goto('http://37.252.0.155/cgi-bin/master');
    await page.$eval('input[name=login]', function (el, value) { el.value = value }, ejudgeLogin);
    await page.$eval('input[name=password]', function (el, value) { el.value = value }, ejudgePassword);
    await page.$eval('input[name=contest_id]', function (el, value) { el.value = value }, contestID);
    await page.$eval('select[name=role]', el => el.value = '6');
    await page.click('input[name=action_2]');
    currentUrl = page.url();
    console.log(currentUrl);
}

async function handleSolution(solutionFileBase64, taskID) {
    if (!browserIsOpen) {
        browser = await puppeteer.launch({ headless: false }); // Запуск браузера, если не был запущен ранее
    }

    // Создание временного файла с решением
    const solutionFilePath = path.join(os.tmpdir(), `solution.py`);
    fs.writeFileSync(solutionFilePath, Buffer.from(solutionFileBase64, 'base64'));
    const page = await browser.newPage();
    functionUrl = currentUrl.replace("&action=2", "") + `&problem=${taskID}&action_206`;
    console.log(functionUrl);
    await page.goto(functionUrl);
    await page.screenshot({
        path: 'debug_data/screenshot-2.jpg',
        fullPage: true
    });
    await page.select('select[name="lang_id"]', languageExtensions['py']);
    const inputUploadHandle = await page.$('input[type="file"]');
    await inputUploadHandle.uploadFile(solutionFilePath);
    await page.click('input[type="submit"][name="action_40"]');
    await page.waitForTimeout(5000);

    // Удаление временного файла после использования
    fs.unlinkSync(solutionFilePath);
}

async function getResult(){
    if (!browserIsOpen) {
        browser = await puppeteer.launch({ headless: false });
        browserIsOpen = true;
    }
    const page = await browser.newPage();
    await page.goto(currentUrl);

    // Получаем статус решения из системы
    async function getSubmissionStatus() {
        return await page.$eval('table.b1 > tbody > tr:nth-child(2) > td:nth-child(6)', el => el.textContent.trim());
    }

    async function getFailureDetails() {
        return await page.$eval('table.b1 > tbody > tr:nth-child(2) > td:nth-child(7)', el => el.textContent.trim());
    }
    let error = await getFailureDetails();
    let status = await getSubmissionStatus();
    while (status === 'Compiling...') {
        await new Promise(resolve => setTimeout(resolve, 500)); // Релоуд каждые 0.5с. Можно поменять, время в мс.
        await page.reload();
        status = await getSubmissionStatus();
    }
    if (status !== "OK") {
        console.log('Failed at:', error, "test.");
    }
    console.log('Final status:', status);
    return { status, error };
}

async function parseTasks(){
    let currentTask = 1;
    if (!browserIsOpen) {
        browser = await puppeteer.launch({ headless: false }); // Запуск браузера, если не был запущен ранее
    }
    const page = await browser.newPage();
    functionUrl = currentUrl.replace("&action=2", "") + `&problem=1&action_206`;
    console.log(functionUrl);
    await page.goto(functionUrl);
    await page.screenshot({
        path: 'debug_data/screenshot.jpg',
        fullPage: true
    });
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
    for (let i = 0; i < tasks.length; i++) {
        console.log(tasks[i]);
    }
}
async function main() {
    // await auth();
    //await handleSolution();
    //await getResult();
    //await parseTasks();
}

module.exports = {
    auth,
    handleSolution,
    getResult,
    parseTasks,
    browser,
    browserIsOpen,
    currentUrl,
    functionUrl,
    fileExtension,
    contestID,
    ejudgeLogin,
    ejudgePassword,
    tasks,
};

//main();


