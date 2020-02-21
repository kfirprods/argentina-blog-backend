var express = require('express');
var router = express.Router();
var fs = require('fs');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const exists = util.promisify(fs.exists);

let parameters = new Array();

async function getPostsForDestination(destinationName) {
  const postsFolderPath = `data/destinations/${destinationName}/posts`;
  if (!(await exists(postsFolderPath))) {
    return Promise.resolve([]);
  }

  const destinationPostNames = await readDir(postsFolderPath);

  return destinationPostNames.map(async postName => {
    const rawPostJson = await readFile(`data/destinations/${destinationName}/posts/${postName}/data.json`);
    const post = JSON.parse(rawPostJson);
    post.id = postName;

    post.photosCount = post.paragraphs.map(paragraph => {
      if (paragraph.media === undefined) {
        return 0;
      }
      if (post.gallery.includes(paragraph.media.source)) {
        return 0;
      }

      return 1;
    }).reduce((a, b) => a + b, 0) + post.gallery.length;

    post.paragraphs = [];
    return post;
  });
}

router.get('/argentina/destinations', async (req, res, next) => {
  const destinationNames = await readDir('data/destinations');
  const destinations = new Array();

  for (let destinationName of destinationNames) {
    const rawDestinationJson = await readFile(`data/destinations/${destinationName}/data.json`);
    const destination = JSON.parse(rawDestinationJson);
    const posts = await Promise.all(await getPostsForDestination(destinationName));
    destination.id = destinationName;
    destination.postsCount = posts.length;
    destination.photosCount = posts.map(post => post.photosCount).reduce((a, b) => a + b, 0);
    destinations.push(destination);
  }

  res.json(destinations);
});

router.get('/argentina/destinations/:destinationId/posts', async (req, res, next) => {
  const posts = await Promise.all(await getPostsForDestination(req.params.destinationId));
  res.json(posts);
});

for (let depth of new Array("dir1", "dir2", "dir3", "dir4", "dir5")) {
  parameters.push(depth);
  let urlParams = parameters.toString();

  while (urlParams.indexOf(',') !== -1) {
    urlParams = urlParams.replace(',', '/:')
  }

  let route = `/argentina/:${urlParams}`;
  router.get(route, handleGenericGetRequest);
  router.put(route, handleGenericPutRequest);
  router.post(route, handleGenericPostRequest);
  router.delete(route, handleGenericDeleteRequest);
}

function getPathFromGenericParams(requestParams) {
  const providedParams = new Array(
    requestParams.dir1,
    requestParams.dir2,
    requestParams.dir3,
    requestParams.dir4,
    requestParams.dir5
  );

  let desiredPath = "";

  for (let providedParam of providedParams) {
    if (providedParam === undefined) {
      break;
    }

    if (providedParam.indexOf('..') !== -1) {
      console.log(`Declining parameter ${providedParam} due to ..`);
      break;
    }

    desiredPath += `/${providedParam}`;
  }

  return desiredPath;
}

function handleGenericGetRequest(req, res, next) {
  const desiredPath = getPathFromGenericParams(req.params);
  let desiredDataFolder = `data${desiredPath}`;
  let desiredDataFile = `${desiredDataFolder}/data.json`;

  if (fs.existsSync(desiredDataFile)) {
    console.log(`Retrieving file ${desiredDataFile}`)
    fs.readFile(desiredDataFile, (err, data) => {
      try {
        res.json(JSON.parse(data));
      }
      catch (err) {
        console.log(err);
      }
    });
  }
  else {
    console.log(`Retrieving folder ${desiredDataFolder}`)
    fs.readdir(desiredDataFolder, (err, files) => {
      res.json(files);
    });
  }
}

function handleGenericPutRequest(req, res, next) {
  const request = req.body;
  if (request.authentication.password !== "blog1738") {
    res.status(401);
    res.send();
    return;
  }

  const desiredPath = getPathFromGenericParams(req.params);
  let desiredDataFolder = `data${desiredPath}`;
  let desiredDataFile = `${desiredDataFolder}/data.json`;

  if (fs.existsSync(desiredDataFile)) {
    console.log(`Put failed for already existing path ${desiredDataFile}`);
    res.status(401);
    res.send();
    return;
  }

  fs.mkdir(desiredDataFolder, () => {
    fs.writeFile(desiredDataFile, JSON.stringify(request.data), {}, () => {
      res.status(200);
      res.send();
    });
  });
}

function handleGenericDeleteRequest(req, res, next) {
  const request = req.body;
  if (request.authentication.password !== "blog1738") {
    res.status(401);
    res.send();
    return;
  }

  const desiredPath = getPathFromGenericParams(req.params);
  let desiredDataFolder = `data${desiredPath}`;
  let desiredDataFile = `${desiredDataFolder}/data.json`;

  if (!fs.existsSync(desiredDataFile)) {
    console.log(`Delete failed for non existing path ${desiredDataFile}`);
    res.status(401);
    res.send();
    return;
  }

  fs.rmdir(desiredDataFolder, { recursive: true }, () => {
    res.status(200);
    res.send();
  });
}

function handleGenericPostRequest(req, res, next) {
  const request = req.body;
  if (request.authentication.password !== "blog1738") {
    res.status(401);
    res.send();
    return;
  }

  const desiredPath = getPathFromGenericParams(req.params);
  let desiredDataFolder = `data${desiredPath}`;
  let desiredDataFile = `${desiredDataFolder}/data.json`;

  if (!fs.existsSync(desiredDataFile)) {
    console.log(`Post failed for non existing path ${desiredDataFile}`);
    res.status(401);
    res.send();
    return;
  }

  fs.writeFile(desiredDataFile, JSON.stringify(request.data), () => {
    res.status(200);
    res.send();
  });
}

module.exports = router;
