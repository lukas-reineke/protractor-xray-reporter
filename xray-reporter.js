const getDate = () => {
    const date = new Date();
    const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    let tz = (utc - date.getTime()) / (60 * 60 * 1000);

    switch (true) {
        case (tz === 0):
            tz = '+00:00';
            break;
        case (tz < 9 && tz > 0):
            tz = '+0' + tz + ':00';
            break;
        case (tz > -9 && tz < 0):
            tz = '-0' + Math.abs(tz) + ':00';
            break;
        case (tz > 9):
            tz = '+' + tz + ':00';
            break;
        default:
            tz = tz + ':00';
            break;
    }

    return date.toISOString().split('.')[0] + tz;
};

const XrayReporter = (options, onPrepareDefer, onCompleteDefer, browser) => {
    const XrayService = require('./xray-service')(options);

    let result = {
        info: {
            description: options.description,
            version: options.version
        },
        tests: []
    };

    if (!options.hasOwnProperty('xrayUrl') || !options.hasOwnProperty('jiraPassword') || !options.hasOwnProperty('jiraUser')) {
        throw new Error('required options are missing');
    }

    browser.getProcessedConfig().then((config) => {
        result.info.summary = config.capabilities.name || 'no name';
        onPrepareDefer.fulfill();
    });

    let specPromises = [];
    let specPromisesResolve = {};

    this.suiteStarted = (suite) => {
        result.tests.push({
            testKey: suite.description.split('@')[1],
            start: getDate(),
            status: 'PASS',
            steps: []
        });
    };

    this.specStarted = (spec) => {
        specPromises.push(new Promise((resolve) => {
            specPromisesResolve[spec.id] = resolve;
        }));
    };

    this.specDone = (spec) => {
        if (spec.status === 'disabled') {
            result.tests[0].steps.push({});
            specPromisesResolve[spec.id]();
        } else {

            let specResult;

            if (spec.status !== 'passed') {
                result.tests[0].status = 'FAIL';
                let comment = '';
                for (let expectation of spec.failedExpectations) {
                    comment += expectation.message;
                }
                specResult = {
                    status: 'FAIL',
                    comment,
                    evidences: []
                };
            } else {
                specResult = {
                    status: 'PASS',
                    evidences: []
                };
            }

            if ((specResult.status === 'FAIL' && options.screenshot !== 'never') || options.screenshot === 'always') {
                let specDonePromises = [];

                specDonePromises.push(new Promise((resolve) => {
                    browser.takeScreenshot().then((png) => {
                        specResult.evidences.push({
                            data: png,
                            filename: 'screenshot.png',
                            contentType: 'image/png'
                        });
                        resolve();
                    });
                }));

                Promise.all(specDonePromises).then(() => {
                    result.tests[0].steps.push(specResult);
                    specPromisesResolve[spec.id]();
                });

            } else {
                result.tests[0].steps.push(specResult);
                specPromisesResolve[spec.id]();
            }
        }
    };

    this.suiteDone = (suite) => {
        result.tests[0].finish = getDate();
        Promise.all(specPromises).then(() => {
            XrayService.createExecution(result, () => {
                onCompleteDefer.fulfill();
            });
        });
    };

    return this;
};

module.exports = XrayReporter;

