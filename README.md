[![npm version](https://badge.fury.io/js/protractor-xray-reporter.svg)](https://badge.fury.io/js/protractor-xray-reporter)

Generates [X-Ray for Jira](https://marketplace.atlassian.com/plugins/com.xpandit.plugins.xray/server/overview)
test executions for protractor tests.


# How to use

* Install protractor-xray-reporter with npm

```bash
npm install --save-dev protractor-xray-reporter
```

* Update your protractor.conf.js file

```javascript
const XrayReporter = require('protractor-xray-reporter');

// Jasmine does not support promises for reporters, but protractor does for
// onPrepare and onComplete. We can use that to make the reporter async as
// well. Generate two promises on onPrepare and add them as arguments to the
// reporter.
let onPrepareDefer;
let onCompleteDefer;

exports.config = {
    'specs': [
        'example_spec.js'
    ],
    'framework': 'jasmine2',
    'directConnect': true,
    'capabilities': {
        // the name is what the test set will be called. Default is 'no name'
        'name': 'Google Chrome',
        'browserName': 'chrome'
    },
    'onPrepare': function() {

        // first promise is to make sure we get the test set name before the tests start.
        onPrepareDefer = protractor.promise.defer();
        // second promise is to make sure everything is done before protractor
        // quits
        onCompleteDefer = protractor.promise.defer();

        const options = {
            'screenshot': 'fail',
            'version': '1.0',
            'jiraUser': 'XXX',
            'jiraPassword': 'XXX',
            'xrayUrl': 'https://jira.com/rest/raven/1.0/import/execution'
        };

        // add the reporter
        jasmine.getEnv().addReporter(XrayReporter(options, onPrepareDefer, onCompleteDefer, browser));

        // return the promises for onPrepare..
        return onPrepareDefer.promise;
    },
    'onComplete': function() {
        // ..and onComplete
        return onCompleteDefer.promise;
    }
};
```

# Options
* `screenshot`

 protractor-xray-reporter can attach screenshots to test executions. Default
 is `fail`
 - `never`  Never attach screenshots
 - `fail`   only attach screenshots if the test failed
 - `always` always attach screenshots

* `version`

 You can attach a version to the execution.
 The version has to exist before it is used, currently this reporter does not
 create versions.

* `jiraUser` (required)
* `jiraPassword` (required)
* `xrayUrl` (required)

 This is your Xray api url

# Test Setup

A test set is represented by a describe block.
The test set ID has to be added at the end of the description with an @
symbol.

A test step is represented by an it block.

```javascript
describe('test set description @ABC-1', function() {

    it('should do something', function() {
        expect(2).toEqual(2);
    });

    it('should do something else', function() {
        expect(3).toEqual(3);
    });

});
```

# References

#### Xray API documentation

http://confluence.xpand-addons.com/pages/viewpage.action?pageId=19695422

