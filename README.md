# Puppeteer Ejudge API

This project provides an API to interact with the Ejudge platform using Puppeteer for web scraping. The main functionality includes user authentication, handling solutions, getting results, and parsing tasks.
Prerequisites

To run this project, you need to have Node.js and npm installed on your machine.
Installation

### Clone the repository:

```
git clone https://github.com/Task-Testing-System-Devs/test-system-handler.git
```

### Go to the project directory:

```
cd test-system-handler
```

### Install the required dependencies:

```
npm install
```

### Usage

#### Start the server:

```
node puppeteerApi.js
```

    The API will be running at http://localhost:3000.

    Use the following endpoints to interact with the Ejudge platform:

        POST /auth: Authenticate a user. Requires a JSON body with login, password, and contestID.

        POST /handleSolution: Handle a solution for a specific task. Requires a JSON body with solutionFileBase64 (base64-encoded solution file) and taskID.

        GET /getResult: Retrieve the result of the last submitted solution.

        GET /parseTasks: Retrieve a list of tasks from the current contest.

### Rate Limiting

The server has rate limiting implemented to protect against abuse (DDoS). It allows a maximum of 300 requests within a 5-minute window.
### Error Handling

The server has basic error handling implemented. If an error occurs while processing a request, it will return a 500 status code with an error message.


## Starting Docker

Go to the root folder of your project and run the following command to build a Docker image:

```
docker-compose build --no-cache
```

Run the container with your image using the following command:

```
sudo docker-compose up
```

You are all set!
