const fs = require('fs');

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

    if (!options.hasOwnProperty('xrayUrl') || !options.hasOwnProperty('jiraPassword') || !options.hasOwnProperty('jiraUser')) {
        throw new Error('required options are missing');
    }

    const buildImageName = (specId) => {
        let imageName = './';
        imageName += browser.params.imageComparison.diffFolder;
        imageName += '/';
        imageName += specId;
        imageName += '-';
        imageName += browser.params.imageComparison.browserName;
        imageName += '-';
        imageName += browser.params.imageComparison.browserWidth;
        imageName += 'x';
        imageName += browser.params.imageComparison.browserHeight;
        imageName += '-dpr-';
        imageName += browser.params.imageComparison.devicePixelRatio;
        imageName += '.png';
        return imageName;
    };

    const XrayService = require('./xray-service')(options);

    const defaultInfo = {
        description: options.description,
        version: options.version
    }

    let result = {
        info: options.info ? options.info : defaultInfo,
        tests: []
    };

    browser.getProcessedConfig().then((config) => {
        result.info.summary = config.capabilities.name || 'no name';
        if(onPrepareDefer.resolve){
            onPrepareDefer.resolve();
        } else {
            onPrepareDefer.fulfill();
        }
    });

    let specPromises = [];
    let specPromisesResolve = {};

    this.suiteStarted = (suite) => {
        result.tests.push({
            testKey: suite.description.split('@')[1],
            start: getDate(),
            steps: []
        });
    };

    this.specStarted = (spec) => {
        specPromises.push(new Promise((resolve) => {
            specPromisesResolve[spec.id] = resolve;
        }));
    };

    this.specDone = (spec) => {
        const testKey = spec.fullName.split('@')['1'].split(' ')[0];
        let index;
        result.tests.forEach((test, i) => {
            if (test.testKey === testKey) {
                index = i;
            }
        });

        if (spec.status === 'disabled') {
            result.tests[index].steps.push({
                status: 'TODO',
                id: spec.id
            });
            specPromisesResolve[spec.id]();
        } else {

            let specResult;

            if (spec.status !== 'passed') {
                result.tests[index].status = 'FAIL';
                let comment = '';
                for (let expectation of spec.failedExpectations) {
                    comment += expectation.message;
                }
                specResult = {
                    status: 'FAIL',
                    comment,
                    evidences: [],
                    id: spec.id
                };
            } else {
                result.tests[index].status !== 'FAIL' ? result.tests[index].status = 'PASS' : 'FAIL';
                specResult = {
                    status: 'PASS',
                    evidences: [],
                    id: spec.id
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

                const specId = spec.description.split('@')[1];
                if (browser.params.imageComparison && specId && fs.existsSync(buildImageName(specId))) {
                    specDonePromises.push(new Promise((resolve) => {
                        fs.readFile(buildImageName(specId), (error, png) => {
                            if (error) {
                                throw new Error(error);
                            } else {
                                specResult.evidences.push({
                                    data: new Buffer(png).toString('base64'),
                                    filename: 'diff.png',
                                    contentType: 'image/png'
                                });
                                resolve();
                            }
                        });
                    }));
                }

                Promise.all(specDonePromises).then(() => {
                    result.tests[index].steps.push(specResult);
                    specPromisesResolve[spec.id]();
                });

            } else {
                result.tests[index].steps.push(specResult);
                specPromisesResolve[spec.id]();
            }
        }
    };

    this.suiteDone = (suite) => {
        const testKey = suite.description.split('@')[1];
        for (let test of result.tests) {
            if (test.testKey === testKey) {
                test.finish = getDate();
                break;
            }
        }
    };

    this.jasmineDone = () => {
        Promise.all(specPromises).then(() => {
            result.tests = result.tests.filter((test) => {
                return !!test.status;
            });
            for (let test of result.tests) {
                test.steps.sort((a, b) => {
                    return parseInt(a.id.replace('spec', '')) - parseInt(b.id.replace('spec', ''));
                }).forEach((step) => {
                    delete step.id;
                });
            }
            XrayService.createExecution(result, () => {
                if(onCompleteDefer.resolve){
                    onCompleteDefer.resolve();
                } else {
                    onCompleteDefer.fulfill();
                }
            });
        });
    };

    return this;
};

module.exports = XrayReporter;

