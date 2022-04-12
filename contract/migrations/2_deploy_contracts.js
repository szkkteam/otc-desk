const SimpleOtcMarket = artifacts.require("SimpleOtcMarket");
const UniswapPriceOracle = artifacts.require("UniswapPriceOracle");

module.exports = async (deployer, network, [defaultAccount]) => {

    let oracle;

    if (network.startsWith('kovan')) {

      factoryAddr = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

      await deployer.deploy(UniswapPriceOracle, factoryAddr);
      oracle = await UniswapPriceOracle.deployed();

    } else if (network.startsWith('development')) {

      factoryAddr = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

      await deployer.deploy(UniswapPriceOracle, factoryAddr);
      oracle = await UniswapPriceOracle.deployed();
    }

    await deployer.deploy(SimpleOtcMarket, oracle.address);
    const simpleOtcMarket = await SimpleOtcMarket.deployed();
    
    console.log(
        `Oracle deployed at ${oracle.address} in network: ${network}.`
    );
    console.log(
        `SimpleOtcMarket deployed at ${simpleOtcMarket.address} in network: ${network}.`
    );
    
}
