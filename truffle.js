require('babel-register');

module.exports = {
    networks: {
        development: {
            host: "localhost",
            port: 8545,
            gas: 4600036,
            network_id: "*" // Match any network id
        }
    }
};

