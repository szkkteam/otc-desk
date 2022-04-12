import { expect } from "chai";


const truffleAssert = require('truffle-assertions');

//const { expect, assert } = require('chai');
const SimpleOtcMarket = artifacts.require("SimpleOtcMarket");
const ERC20 = artifacts.require("IERC20");
const Router = artifacts.require("IUniswapV2Router02")
const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
  } = require('@openzeppelin/test-helpers');

const wethWhale = "0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8";
const wethAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
//const daiAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const daiAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const routerAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";


const fundWeth = async (to: string, amount: string | number | BN) => {
    const weth = await ERC20.at(wethAddr);
    await weth.transferFrom(wethWhale, to, amount, {from: wethWhale});
}

const buy = async (tokenAddr: string, from: string, amountIn: string | BN | number, amountOut: string | BN | number = 0 ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);
    
    await weth.approve(router.address, amountIn, {from});

    return router.swapExactTokensForTokens(
        amountIn,
        amountOut,
        [weth.address, token.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from}       
    );
}

const buyExact = async (tokenAddr: string, from: string, amountOut: string | BN | number, amountInMax: string | BN | number = toBN(toWei('10')) ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);
    
    await weth.approve(router.address, await weth.balanceOf(from), {from});

    return await router.swapTokensForExactTokens(
        amountOut,
        amountInMax,
        [weth.address, token.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from}       
    );
}

const sell = async (tokenAddr : string, from: string, amountIn: string | BN | number, amountOut: string | BN | number = 0 ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);  
    
    await token.approve(router.address, amountIn, {from});

    return router.swapExactTokensForTokens(
        amountIn,
        amountOut,
        [token.address, weth.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from}       
    );
}

const toWei = (amount: string) => {
    return web3.utils.toWei(amount, 'ether');
}

const toBN = (amount: string | number) => {
    return web3.utils.toBN(amount);
}

contract("SimpleOtcMarket", ([deployer, user1, user2, user3, user4]) => {

    before(async () => {
        const instance = await SimpleOtcMarket.deployed();
        const dai = await ERC20.at(daiAddr);
        const weth = await ERC20.at(wethAddr);  

        const balance = await weth.balanceOf(wethWhale);
        // Approve the weth transfer
        await weth.approve(wethWhale, balance, {from: wethWhale});
        /*
        fundWeth(deployer, web3.utils.toWei('1', 'ether'));
        fundWeth(user1, web3.utils.toWei('1', 'ether'));
        fundWeth(user2, web3.utils.toWei('1', 'ether'));
        fundWeth(user3, web3.utils.toWei('1', 'ether'));
        */
    });

    describe("make offer", async () => {

        beforeEach(async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  
    

            fundWeth(deployer, toWei('1'));    
            fundWeth(user1, toWei('2'));          

            
            
        });

        it("should transfer offer token to contract", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  
    

            let offerId;
            const balanceBefore: BN = await weth.balanceOf(deployer);
            const contractBalanceBefore: BN = await weth.balanceOf(instance.address);

            await weth.approve(instance.address, toWei('1'), {from: deployer});

            await instance.offer(weth.address, dai.address, toWei('1'), toBN(-5000)).then(({logs} : {logs: any}) => {
                offerId = logs[0].args.offerId;
            });

            const balanceAfter: BN = await weth.balanceOf(deployer);
            const contractBalanceAfter: BN = await weth.balanceOf(instance.address);
            
            expect(balanceBefore.toString()).to.be.equal((balanceAfter.add(toBN(toWei('1'))).toString()));
            expect(contractBalanceAfter.toString()).to.be.equal((contractBalanceBefore.add(toBN(toWei('1'))).toString()));
        });

        it("should accept offer", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  

            await instance.offer(weth.address, dai.address, toWei('1'), toBN(-5000));
            const offerId = await instance.lastOfferId();

            const { tokenWant, amountOffer } = await instance.getOffer(offerId);

            console.log(`
                Token want: ${tokenWant}
                Dai address: ${dai.address}
                Offer: ${amountOffer}
            `);

            const amountIn: BN = await instance.getAmountInForOffer(offerId, amountOffer);

            await buyExact(dai.address, user1, amountIn);

            const balance = await dai.balanceOf(user1);
            console.log(`
                AmountIn: ${web3.utils.fromWei(amountIn.toString(),'ether')}
                User1 Balance: ${web3.utils.fromWei(balance.toString(), 'ether')}
            `);
            //expect(amountIn.toString()).to.be.equal(toBn(1).toString());
            

            //const [, , amountOffer, ] = offer;

            

            await dai.approve(instance.address, amountIn, {from: user1});
            const allowed = await dai.allowance(user1, instance.address);

            console.log(`
                Allowed to ${instance.address}: ${web3.utils.fromWei(allowed.toString(), 'ether')}
            `)

            await instance.take(offerId, amountOffer);
        });
    });
    /*
    it("it should work", async () => {
        const instance = await SimpleOtcMarket.deployed();
        const dai = await ERC20.at(daiAddr);
        const weth = await ERC20.at(wethAddr);  

        //await buy(dai.address, user1, web3.utils.toWei('1000', 'ether'));
        fundWeth(deployer, web3.utils.toWei('1', 'ether'));
        await weth.approve(instance.address, web3.utils.toWei('0.1', 'ether'), {from: deployer});

        //let offerId = await instance.offer.call(weth.address, dai.address, web3.utils.toWei('0.1', 'ether'), web3.utils.toBN(5000));
        await instance.offer(weth.address, dai.address, web3.utils.toWei('0.1', 'ether'), web3.utils.toBN(5000)).then(({logs} : {logs: any}) => {
            console.log(logs);
        });

        const offerInfo = await instance.getOffer(1);
        console.log(`Offer info: ${JSON.stringify(offerInfo)}`)
        //console.log(JSON.stringify(tx));
    });
    */
});