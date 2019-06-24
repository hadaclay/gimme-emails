const nodegit = require("nodegit");
const tmp = require("tmp");
const axios = require("axios");
const ora = require("ora");
const path = require("path");

//TODO: add more invalid emails in processEmailList()
//TODO: output text file of emails instead of console.log()
//TODO: different verbosity command line args

// Create temp directory
const tmpDir = tmp.dirSync();
const spinner = ora();

let isUserPage = null;

main().catch(console.error);

async function main() {
  if (process.argv.length === 3) {
    const githubURLs = await parseArgumentURL(process.argv[2]);
    Promise.all(cloneRepos(githubURLs)).then(emails => {
      // Hack to make `emails` variable populate and not return empty because of async
      setTimeout(() => {
        spinner.stop();
        const processedEmails = processEmailList(emails);
        processedEmails.length > 0 ? console.log(processedEmails) : console.log("No Emails Found :(");
      }, 50);
    });
  } else {
    console.log("Syntax: npm run start <GitHub URL>");
  }

  return tmpDir.removeCallback();
}

function cloneRepos(repoLinks) {
  return repoLinks.map(repo => cloneRepoEmails(repo));
}

async function cloneRepoEmails(repoName) {
  function getRepoName(repoPath) {
    const tempArray = repoPath.split("/");
    return tempArray[tempArray.length - 1];
  }

  const localPath = path.join(tmpDir.name, getRepoName(repoName));
  const repoEmails = [];

  const repo = await nodegit.Clone(repoName, localPath, { bare: 1 });
  const masterCommit = await repo.getHeadCommit();
  const history = masterCommit.history(nodegit.Revwalk.SORT.TIME);

  history.on("commit", commit => {
    repoEmails.push(commit.author().email());
  });

  history.start();
  spinner.start(`Cloning Repo${isUserPage ? 's' : ''}`);

  return repoEmails;
}

async function getUserRepos(url) {
  const username = url.split("/")[3]; // assumes every url input has https://github.com/user
  const requestURL = `https://api.github.com/users/${username}/repos`;
  const requestConfig = {
    headers: {
      Accept: "application/vnd.github.v3+json"
    }
  };

  const userRepos = await axios.get(requestURL, requestConfig);
  return await userRepos.data.map(repo => repo.svn_url);
}

async function parseArgumentURL(url) {
  const splitURL = url.split("/");
  if (splitURL.length === 5) { // Repo Page
    isUserPage = false;
    console.log(`Repo Page for ${splitURL[3]}/${splitURL[4]}`);
    return [url];
  } else if (splitURL.length === 4) { // User Page
    isUserPage = true;
    console.log(`User Page for ${splitURL[3]}`);
    const urls = await getUserRepos(url);
    return urls;
  }
}

function processEmailList(emails) {
  const temp = [].concat.apply([], emails);
  return temp
    .filter((item, i, arr) => arr.indexOf(item) === i)
    .filter(email => email.includes("users.noreply.github.com") === false);
}
