const express = require('express');
const cors = require('cors');
const { auth, handleSolution, getResult, parseTasks } = require('./puppeteer.js');
const {currentUrl, tasks} = require("./puppeteer");
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/auth', async (req, res) => {
    try {
        const { login, password, contestID } = req.body;
        await auth(login, password, contestID);
        res.status(200).json({ message: 'Authenticated successfully' });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: 'Error authenticating' });
    }
});

app.post('/handleSolution', async (req, res) => {
    try {
        console.log(req.body);
        const { solutionFileBase64, taskID } = req.body;
        console.log(taskID);
        if (!taskID) {
            res.status(400).json({ error: 'Task ID is required' });
            return;
        }
        await handleSolution(solutionFileBase64, taskID);
        res.status(200).json({ message: 'Solution handled successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Error handling solution' });
    }
});


app.get('/getResult', async (req, res) => {
    try {
        const {status, error} = await getResult();
        res.status(200).json({ message: 'Result retrieved successfully', status: status, error: error });
    } catch (error) {
        res.status(500).json({ error: 'Error retrieving result' });
    }
});

app.get('/parseTasks', async (req, res) => {
    try {
        const tasks = await parseTasks();
        res.status(200).json({ message: tasks });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: 'Ошибка при получении заданий. Возможно, вы не авторизованы.' });
    }
});

app.listen(port, () => {
    console.log(`Puppeteer API listening at http://localhost:${port}`);
});