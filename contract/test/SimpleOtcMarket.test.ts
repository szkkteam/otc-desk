import { expect } from "chai";
import {
    fundWeth,
    fundToken,
    tokenToWei,
    buy,
    buyEth,
    buyExact,
    sell,
    toBN,
    toWei
} from '../utils/helpers';

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
const daiAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
//const usdcAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const routerAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";


contract("SimpleOtcMarket", ([deployer, user1, user2, user3, user4]) => {

    before(async () => {
        const weth = await ERC20.at(wethAddr);  

        const balance = await weth.balanceOf(wethWhale);
        // Approve the weth transfer
        await weth.approve(wethWhale, balance, {from: wethWhale});
    });

    describe("make offer", async () => {
        /*
        before(async () => {
            fundWeth(deployer, toWei('1'));    
            fundWeth(user1, toWei('2'));          
        });
        */

        beforeEach(async () => {
            
        });

        describe("should make an offer", async () => {

            it("in weth", async () => {
                const instance = await SimpleOtcMarket.deployed();    
                const dai = await ERC20.at(daiAddr);
                const weth = await ERC20.at(wethAddr);  

                await fundWeth(deployer, toWei('1'));    

                const spend = toWei('0.1');
                const balanceBefore = await weth.balanceOf(deployer);
                // Must approve before use
                await weth.approve(instance.address, spend, {from: deployer});

                const tx = await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
                truffleAssert.eventEmitted(tx, "OfferMade");

                const balanceAfter = await weth.balanceOf(deployer);
                const balanceInstance = await weth.balanceOf(instance.address);

                expect(balanceAfter.toString()).to.be.equal(balanceBefore.sub(toBN(spend)).toString());
                expect(balanceInstance.toString()).to.be.equal(spend);
            });

            it("in dai", async () => {
                const instance = await SimpleOtcMarket.deployed();    
                const dai = await ERC20.at(daiAddr);
                const weth = await ERC20.at(wethAddr);  
                
                // Fund 1000 dai
                const spend = await tokenToWei(dai.address, '1000');

                await fundToken(deployer, spend, dai.address);
                const balanceBefore = await dai.balanceOf(deployer);

                // Must approve before use
                await dai.approve(instance.address, spend, {from: deployer});

                const tx = await instance.offer(dai.address, weth.address, spend, toBN(-5000), {from: deployer});
                truffleAssert.eventEmitted(tx, "OfferMade");

                const balanceAfter = await dai.balanceOf(deployer);
                const balanceInstance = await dai.balanceOf(instance.address);

                expect(balanceAfter.toString()).to.be.equal(balanceBefore.sub(spend).toString());
                expect(balanceInstance.toString()).to.be.equal(spend.toString());

            });

            it("should emit last offer id", async () => {
                const instance = await SimpleOtcMarket.deployed();    
                const dai = await ERC20.at(daiAddr);
                const weth = await ERC20.at(wethAddr);  

                await fundWeth(deployer, toWei('1'));    

                const spend = toWei('0.1');
                const balanceBefore = await weth.balanceOf(deployer);
                // Must approve before use
                await weth.approve(instance.address, spend, {from: deployer});

                let offerId: BN = toBN(0);
                const tx = await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
                truffleAssert.eventEmitted(tx, "OfferMade", (event: any) => {
                    offerId = event.offerId;
                    return true;
                });

                const lastOfferId = await instance.getOfferId();
                // TODO: appended with zeros
                //expect(lastOfferId.toString()).to.be.equal(offerId.toString());

            });

            it("should fail if not approved", async () => {
                const instance = await SimpleOtcMarket.deployed();    
                const dai = await ERC20.at(daiAddr);
                const weth = await ERC20.at(wethAddr);  

                await fundWeth(deployer, toWei('1'));    

                const spend = toWei('0.1');
                const balanceBefore = await weth.balanceOf(deployer);
                
                // Force remove allowance
                await weth.approve(instance.address, "0", {from: deployer});

                await truffleAssert.fails(instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer}))
                const balanceAfter = await weth.balanceOf(deployer);

                expect(balanceAfter.toString()).to.be.equal(balanceBefore.toString());
            });
        });

        describe("should take an offer", async () => {

            it("in weth", async () => { 
                const instance = await SimpleOtcMarket.deployed();    
                const dai = await ERC20.at(daiAddr);
                const weth = await ERC20.at(wethAddr);  

                await fundWeth(deployer, toWei('1'));    

                const spend = toWei('0.1');
                const takeSpend = spend;
                // Must approve before use
                await weth.approve(instance.address, spend, {from: deployer});

                await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
                const offerId = await instance.getOfferId();
                
                const amountIn: BN = await instance.getAmountInForOffer(offerId, takeSpend);

                await fundToken(user1, amountIn, dai.address);

                await dai.approve(instance.address, amountIn, {from: user1});

                const tx = await instance.take(offerId, takeSpend, {from: user1});
            });
        });

        it("should transfer offer token to contract", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  
    

            let offerId;
            const balanceBefore: BN = await weth.balanceOf(deployer);
            const contractBalanceBefore: BN = await weth.balanceOf(instance.address);

            await weth.approve(instance.address, toWei('1'), {from: deployer});

            await instance.offer(weth.address, dai.address, toWei('1'), toBN(-5000), {from: deployer}).then(({logs} : {logs: any}) => {
                offerId = logs[0].args.offerId;
            });

            const balanceAfter: BN = await weth.balanceOf(deployer);
            const contractBalanceAfter: BN = await weth.balanceOf(instance.address);
            
            expect(balanceBefore.toString()).to.be.equal((balanceAfter.add(toBN(toWei('1'))).toString()));
            expect(contractBalanceAfter.toString()).to.be.equal((contractBalanceBefore.add(toBN(toWei('1'))).toString()));
        });
        
        it("should work", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  

            await buyEth(dai.address, deployer, toWei('1.2'));

            const balanceBefore = await dai.balanceOf(deployer);
            await dai.approve(user1, balanceBefore, {from: deployer});
            await truffleAssert.passes(dai.transferFrom(deployer, user1, balanceBefore, {from: user1}));

            const balanceAfter = await dai.balanceOf(deployer);
            const balanceUser1 = await dai.balanceOf(user1);
            assert.equal("0", balanceAfter.toString());

            await truffleAssert.passes(dai.approve(instance.address, balanceUser1, {from: user1}));
            assert.equal((await dai.allowance(user1, instance.address)).toString(), balanceUser1.toString());
            await truffleAssert.passes(instance.offer(dai.address, weth.address, balanceUser1, toBN(-5000), {from: user1}));

            const balanceAfterUser1 = await dai.balanceOf(user1);
            const balanceInstance = await dai.balanceOf(instance.address);

            assert.equal(balanceAfterUser1.toString(), "0");
            assert.equal(balanceInstance.toString(), balanceUser1.toString());
        });
        /*
        it("should accept offer", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  

            //await instance.offer(weth.address, dai.address, toWei('1'), toBN(-5000), {from: deployer});
            await buyEth(daiAddr, deployer, toWei('1.2'));

            const oneDai = toBN(1).mul(toBN(10).pow(toBN((await dai.decimals()).toString())));

            await daiContract.methods.approve(instance.address, oneDai).send({from: deployer});

            console.log(`
                deployer balance: ${await daiContract.methods.balanceOf(deployer).call()}
                allowance: ${await daiContract.methods.allowance(deployer, instance.address).call()}
                one dais: ${oneDai}
            `)

            await instance.offer(daiAddr, weth.address, oneDai, toBN(-5000), {from: deployer, gas: 6000000});
            const offerId = await instance.lastOfferId();

            const { tokenWant, amountOffer } = await instance.getOffer(offerId);

            console.log(`
                Token want: ${tokenWant}
                Dai address: ${daiAddr}
                Offer: ${amountOffer}
            `);

            const amountIn: BN = await instance.getAmountInForOffer(offerId, amountOffer);

            await buyEth(dai.address, user1, toWei('1.2'));

            const balance = await dai.balanceOf(user1);
            console.log(`
                AmountIn: ${web3.utils.fromWei(amountIn.toString(),'ether')}
                User1 Balance: ${web3.utils.fromWei(balance.toString(), 'ether')}
            `);
            //expect(amountIn.toString()).to.be.equal(toBn(1).toString());
            

            //const [, , amountOffer, ] = offer;

            

            await dai.approve(instance.address, toWei('100000'), {from: user1});
            const allowed = await dai.allowance(user1, instance.address);

            console.log(`
                Allowed to ${instance.address}: ${web3.utils.fromWei(allowed.toString(), 'ether')}
            `)

            await instance.take(offerId, amountOffer, {from: user1});
        });
        */
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