// Script will only ask for permissions for the spreadsheet it is attached to, not all Drive files.
/**
 * @OnlyCurrentDoc
 */

/**
 * Adapted from: https://github.com/18F/fedramp-data/blob/master/scripts/google-sheets-script.gs
 *
 * This script uses a [personal access token](https://github.com/blog/1509-personal-api-tokens) for authentication, which I recommend.
 * Refs: https://developer.github.com/v3/repos/contents/#create-a-file
 */

// Adds a menu item in the spreadsheet that triggers this script's run() function
function onOpen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menuEntries = [
    {name: "Save data to r.d.g.", functionName: "run"}
  ];
  ss.addMenu("Save data to r.d.g.", menuEntries);
}

// variables for committing data to GitHub
var github = {
  'username': '18f',
  'accessToken': '',
  'repository': 'resources.data.gov',
  'branch': 'page-cat-tag',
  'commitMessage': Utilities.formatString('publish data on %s', Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'))
};

// retrieve Github personal access token from the 'credentials' sheet.
function getToken() {
  // open spreadsheet and get value
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('credentials');
  var range = sheet.getRange('A1');
  var result = range.getValues();

  // Set Github access token
  github.accessToken = result[0][0];

  return false;
}

// get last committed SHA value of the pii-inventory.csv file
function getLastSha(filename) {
  var requestUrl = Utilities.formatString(
    'https://api.github.com/repos/%s/%s/contents/%s?ref=%s',
    github.username,
    github.repository,
    filename,
    github.branch
  ),
  response = UrlFetchApp.fetch(requestUrl, {
    'method': 'GET',
    'headers': {
      'Authorization': Utilities.formatString('token %s', github.accessToken)
    }
  }),
  jsonResponse = JSON.parse(response.getContentText());

  return jsonResponse.sha;
}

// commit to Github via API
// lastSha argument is optional, only needed to update files
function commitToGithub (filename, content, lastSha) {

  var requestUrl = Utilities.formatString(
    'https://api.github.com/repos/%s/%s/contents/%s',
    github.username,
    github.repository,
    filename
  );

  var response = UrlFetchApp.fetch(requestUrl, {
    'method': 'PUT',
    'headers': {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'Authorization': Utilities.formatString('token %s', github.accessToken)
    },
    'payload': JSON.stringify({
      'message': github.commitMessage,
      'content': Utilities.base64Encode(content, Utilities.Charset.UTF_8), // Testing with committing current date
      'sha': lastSha,
      'branch': github.branch
    })
  });

  return false;
}

// save contents of spreadsheet as csv
// Adapted from: https://gist.github.com/mrkrndvs/a2c8ff518b16e9188338cb809e06ccf1
function saveCsv() {
  // get the active spreadsheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('rdg resource list');

  // variables for export
  var range = sheet.getDataRange();
  var data = range.getValues();
  var csv = "";

  // build export string
  for (var r = 0; r < data.length; r++) {

    // create empty row
    var row = "";

    // loop through cells in row
    for (var c = 0; c < data[r].length; c++) {

      // replace single quotes with double quotes, for clean csv
      data[r][c] = data[r][c].toString().replace(/"/g,'""');

      // add quotes to fields with commas, for clean csv
      if (data[r][c].toString().indexOf(",") != -1) {
        data[r][c] = "\"" + data[r][c] + "\"";
      }

      // add data to row
      row = row + data[r][c];

      // add comma, if not last cell in row
      if (c < data[r].length - 1) {
        row = row + ",";
      }
    }

    // add row to csv
    csv = csv + row;

    // add newline to csv, if not last row
    if (r < data.length - 1)
      csv = csv + '\n';
  }

  return csv;
}

function run() {
  var csv = saveCsv();

  getToken();

  var filename = 'pages/_data/resources.csv';
  var lastSha = (getLastSha(filename));

  commitToGithub(filename, csv, lastSha);
}
