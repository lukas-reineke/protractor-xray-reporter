const popsicle = require('popsicle');
const auth = require('popsicle-basic-auth');

const XrayService = (options) => {

    this.createExecution = (body, callback) => {
        popsicle.request({
            method: 'POST',
            url: options.xrayUrl,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .use(auth(options.jiraUser, options.jiraPassword))
            .then((res) => {
                if (res.status !== 200) {
                    throw new Error(res.body);
                } else {
                    console.log('Pushed test execution to X-Ray');
                    callback();
                }
            })
            .catch((error) => {
                throw new Error(error);
            });
    };

    return this;
};

module.exports = XrayService;

