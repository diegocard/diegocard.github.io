const express    = require('express');
const Webtask    = require('webtask-tools');
const bodyParser = require('body-parser');
const jwt        = require('jsonwebtoken');

var app = express();
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.send({msg: "OK"});
});

app.post('/issue', verifyAuthorization, parseScope, readStorageData, filterAuthConflicts, (req, res) => {
  let data = req.data,
      userId = req.userId,
      existingDataEntry = req.data.authorizations[userId],
      newDataEntry = req.newDataEntry;

  // Initialize the container list (owners only)
  if (isOwner(newDataEntry)) {
    newDataEntry.containers = [req.scope.container];
  }

  // If already an owner, get the existing container list
  if (existingDataEntry && isOwner(newDataEntry) && isOwner(existingDataEntry)) {
    newDataEntry.containers = newDataEntry.containers.concat(existingDataEntry.containers);
  }

  // Log a new succesful authorization
  data.logs.grants.success.push({
    userId,
    authLevel: req.scope.authorizationLevel,
    container: isAdmin(newDataEntry) ? "*" : req.scope.container,
    timestamp: new Date().getTime()
  });

  // Save the data
  data.authorizations[userId] = newDataEntry;
  req.webtaskContext.storage.set(data, function (writeError) {
    if (writeError) {
      res.send({ msg: "Cannot persist authorization data" });
    } else {
      res.sendStatus(200);
    }
  });
});

app.get('/check', verifyAuthorization, parseScope, readStorageData, (req, res) => {
  let userId = req.webtaskContext.query.userId || "",
      userData = req.data.authorizations[userId];
  if (!userId) {
    res.send({ msg: "Must specify userId (email) and scope" });
  } else if (!userData || isOwner(userData) && !userData.containers.includes(req.scope.container)) {
    // Access denied whenu user was not registered or the user
    // is an owner without access to the specified container
    res.sendStatus(403);

    // Log the resolution
    req.data.logs.validations.failed.push({
      userId,
      authLevel: req.scope.authorizationLevel,
      container: req.scope.container,
      timestamp: new Date().getTime(),
      reason: !userData ? "User not registered" : "Owner does not have authorization"
    });

    // Save the logs
    req.webtaskContext.storage.set(req.data);
  } else {
    // Otherwise, the user is not authorized
    res.sendStatus(200);

    // Log the resolution
    req.data.logs.validations.success.push({
      userId,
      authLevel: req.scope.authorizationLevel,
      container: req.scope.container,
      timestamp: new Date().getTime()
    });

    // Save the logs
    req.webtaskContext.storage.set(req.data);
  }
});

app.post('/revoke', verifyAuthorization, (req, res) => {
  // TODO: implement
  res.sendStatus(200);
});

app.get('/clearData', verifyAuthorization, (req, res) => {
  req.webtaskContext.storage.set(initializeData(), {force: 1}, function (writeError) {
    if (writeError) {
      res.send({ msg: "Cannot clear data" });
    } else {
      res.sendStatus(200);
    }
  });
});

// Express middleware
// Read webtask storage and initialize if empty
function readStorageData(req, res, next) {
  req.webtaskContext.storage.get((readError, storageData) => {
    if (readError) {
      res.send({ msg: "Cannot retrieve authorization data from storage" });
    } else {
      req.data = storageData || initializeData();
      next();
    }
  });
}

// Express middleware
// Filter out all authorization conflicts
function filterAuthConflicts(req, res, next) {
  let userId = req.body.user,
      existingDataEntry = req.data.authorizations[userId],
      newDataEntry = {
        authorizationLevel: req.scope.authorizationLevel,
      };
  req.userId = userId;
  req.newDataEntry = newDataEntry;

  if (isAdmin(existingDataEntry) && isOwner(newDataEntry)) {
    // Case 1: was an admin, and attempting to grant owner
    resolveAuthError(req, res, "User is already an admin");
  } else if (isOwner(existingDataEntry) && isOwner(newDataEntry) && existingDataEntry.containers.includes(req.scope.container)) {
    // Case 2: user is already an owner for the given container
    resolveAuthError(req, res, "User is already an owner for the given container");
  } else {
    // Case 3: no auth conflicts. Continue
    next();
  }
}

function resolveAuthError(req, res, msg) {
  // Send a response
  res.send({msg});

  // Log the error
  req.data.logs.grants.failed.push({
    userId: req.userId,
    authLevel: req.scope.authorizationLevel,
    container: isAdmin(req.newDataEntry) ? "*" : req.scope.container,
    timestamp: new Date().getTime(),
    reason: msg
  });

  // Save the logs
  req.webtaskContext.storage.set(req.data);
}

// Express middleware
// Verify that the user is authorized through JWT
function verifyAuthorization(req, res, next) {
  // Get auth header value
  const bearerHeader = req.headers['authorization'];
  // Check if bearer is undefined
  if(typeof bearerHeader !== 'undefined') {
    // Split at the space
    const bearer = bearerHeader.split(' ');
    // Get token from array
    const bearerToken = bearer[1];
    // Store the token on the request
    req.token = bearerToken;
    const SECRET_KEY = req.webtaskContext.secrets.SECRET_KEY;
    // Verify the token
    jwt.verify(req.token, SECRET_KEY, (err, tokenData) => {
      if (err) {
        res.sendStatus(403);
      } else {
        // TODO: verify claims
        next();
      }
    });
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

// Express middleware
// Read and parse the given scope
function parseScope(req, res, next) {
  let scopeStr = null;
  if (req.method === "GET") {
    scopeStr = req.webtaskContext.query.scope;
  } else {
    scopeStr = req.body.scope;
  }
  // TODO: check scope formatting
  if (!scopeStr) {
    res.send({msg: "You must specify a scope"});
  } else {
    let [wt, authorizationLevel, container] = scopeStr.split(":");
    if (authorizationLevel === "owner" && !container) {
      res.send({ msg: "A container must always be specified if the scope is of type 'owner'" });
    } else {
      req.scope = {wt, authorizationLevel, container};
      next();
    }
  }
}

function initializeData() {
  return {
    authorizations: {},
    logs: {
      grants: {
        success: [],
        failed: []
      },
      validations: {
        success: [],
        failed: []
      }
    }
  };
}

function isAdmin(userData) {
  return userData && userData.authorizationLevel === "admin";
}

function isOwner(userData) {
  return userData && userData.authorizationLevel === "owner";
}

module.exports = Webtask.fromExpress(app);
