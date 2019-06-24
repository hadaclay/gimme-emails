const nodegit = require("nodegit");
const tmp = require("tmp");
const axios = require("axios");
const path = require("path");

// Create temp directory
const tmpDir = tmp.dirSync();

main().catch(console.error);

async function main() {
  if (process.argv.length === 3) {
    const githubURLs = await parseArgumentURL(process.argv[2]);
    Promise.all(cloneRepos(githubURLs))
      .then(emails => { 
        setTimeout(() => console.log(processEmailList(emails)), 10);
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
  if (url.split("/").length === 5) {
    // Repo Page
    console.log("Repo Page");
    return [url];
  } else if (url.split("/").length === 4) {
    // User Page
    console.log("User Page");
    const urls = await getUserRepos(url);
    return urls;
  }
}

function processEmailList(emails) {
  const temp = [].concat.apply([], emails)
  return temp 
    .filter((item, i, arr) => arr.indexOf(item) === i)
    .filter(email => email.includes("users.noreply.github.com") === false);
}
