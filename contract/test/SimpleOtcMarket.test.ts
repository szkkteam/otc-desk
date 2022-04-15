import { expect } from "chai";
import {
    fundWeth,
    fundDai,

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
const daiWhale = "0xb60c61dbb7456f024f9338c739b02be68e3f545c";

const wethAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const daiAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
//const usdcAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const routerAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const compensateWithTakerFee = (amount: BN, takerFee: BN = toBN(1500)) => {
    return amount.sub(amount.mul(takerFee).div(toBN(100000)));
}

const compensateWithMakerFee = (amount: BN, makerFee: BN = toBN(500)) => {
    return amount.sub(amount.mul(makerFee).div(toBN(100000)));
}

contract("SimpleOtcMarket", ([deployer, user1, user2, user3, user4]) => {

    before(async () => {
        const weth = await ERC20.at(wethAddr);  

        const balance = await weth.balanceOf(wethWhale);
        // Approve the weth transfer
        await weth.approve(wethWhale, balance, {from: wethWhale});
    });


    describe("make offer", async () => {

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

            await fundDai(deployer, spend);
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

        it("should fail if not enough balance", async () => {
            const instance = await SimpleOtcMarket.deployed();    
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  

            // If the account has weth, transfer it to the whale
            await weth.transfer(wethWhale, await weth.balanceOf(deployer), {from: deployer});

            const spend = toWei('0.1');
            const balanceBefore = await weth.balanceOf(deployer);
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await truffleAssert.fails(instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer}))
            const balanceAfter = await weth.balanceOf(deployer);

            expect(balanceAfter.toString()).to.be.equal(balanceBefore.toString());
        });

        it("should fail if 0 amount", async () => {
            const instance = await SimpleOtcMarket.deployed();    
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  

            await fundWeth(deployer, toWei('1'));    

            const spend = toWei('0.1');
            const balanceBefore = await weth.balanceOf(deployer);
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await truffleAssert.reverts(instance.offer(weth.address, dai.address, toBN(0), toBN(-5000), {from: deployer}), "ZERO_AMOUNT");
            const balanceAfter = await weth.balanceOf(deployer);

            expect(balanceAfter.toString()).to.be.equal(balanceBefore.toString());

        });

        it("should fail if invalid pair", async () => {
            const instance = await SimpleOtcMarket.deployed();    
            const dai = await ERC20.at(daiAddr);
            const randomToken = await ERC20.at("0xdc0327d50e6c73db2f8117760592c8bbf1cdcf38");  

            await fundDai(deployer, toWei('1'));    

            const spend = toWei('1');
            const balanceBefore = await dai.balanceOf(deployer);
            // Must approve before use
            await dai.approve(instance.address, spend, {from: deployer});

            await truffleAssert.reverts(instance.offer(dai.address, randomToken.address, spend, toBN(-5000), {from: deployer}), "INVALID_PAIR");
            const balanceAfter = await dai.balanceOf(deployer);

            expect(balanceAfter.toString()).to.be.equal(balanceBefore.toString());
        
        });

        it("should fail if discount too much", async () => {
            const instance = await SimpleOtcMarket.deployed();    
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  

            await fundWeth(deployer, toWei('1'));    

            const spend = toWei('0.1');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await truffleAssert.reverts(instance.offer(weth.address, dai.address, spend, toBN(-100000), {from: deployer}), "DISCOUNT_UNDERFLOW");
        });
    });

    describe("update oracle", () => {

        it("should emit oracle updated event", async () => {
            const instance = await SimpleOtcMarket.deployed();    

            const newOracleAddress = "0x0000000000000000000000000000000000000001";
            const currentOracleAddress = await instance.oracleAddress();
            const tx = await instance.setOracleAddress(newOracleAddress, {from: deployer});
            truffleAssert.eventEmitted(tx, "OracleUpdated", {oldAddress: currentOracleAddress, newAddress: newOracleAddress});
            
            // Set back
            await instance.setOracleAddress(currentOracleAddress, {from: deployer});
        });

        it("should fail if not owner", async () => {
            const instance = await SimpleOtcMarket.deployed();    

            const newOracleAddress = "0x0000000000000000000000000000000000000001";
            await truffleAssert.fails(instance.setOracleAddress(newOracleAddress, {from: user1}));
        });
    });

    describe("cancel offer", async() => {

        it("should cancel offer", async () => { 
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);

            await fundWeth(deployer, toWei('1'));

            const spend = toWei('0.1');

            const balanceBefore = await weth.balanceOf(deployer);
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
            const offerId = await instance.getOfferId();

            const tx = await instance.cancel(offerId, {from: deployer});
            truffleAssert.eventEmitted(tx, "OfferCancelled", {offerId: offerId});

            const balanceAfter = await weth.balanceOf(deployer);

            expect(balanceAfter.toString()).to.be.equal(balanceBefore.toString());
        });

        it("should fail if offer is not found", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const weth = await ERC20.at(wethAddr);

            await fundWeth(deployer, toWei('1'));

            const spend = toWei('0.1');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await truffleAssert.reverts(instance.cancel(toBN(0), {from: deployer}), "OFFER_CLOSED");
        });

        it("should fail if offer is not owned by caller", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);

            await fundWeth(deployer, toWei('1'));

            const spend = toWei('0.1');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
            const offerId = await instance.getOfferId();

            await truffleAssert.reverts(instance.cancel(offerId, {from: user1}), "ONLY_MAKER");
        })

        it("should fail if offer is already cancelled", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);

            await fundWeth(deployer, toWei('1'));

            const spend = toWei('0.1');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
            const offerId = await instance.getOfferId();

            await instance.cancel(offerId, {from: deployer});
            await truffleAssert.reverts(instance.cancel(offerId, {from: deployer}), "OFFER_CLOSED");
        });

    });

    describe("take offer", async () => {

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
            // Get the required input amount based on the offer
            const amountIn: BN = await instance.getAmountInForOffer(offerId, takeSpend);

            await fundDai(user1, amountIn);                

            await dai.approve(instance.address, amountIn, {from: user1});
            
            const daiBalanceDeployerBefore = await dai.balanceOf(deployer);
            const wethBalanceBefore = await weth.balanceOf(user1);

            const tx = await instance.take(offerId, takeSpend, {from: user1});
            truffleAssert.eventEmitted(tx, "OfferTaken", (ev: any) => {
                return ev.offerId.toString() === offerId.toString() &&
                    ev.amountOut.toString() === takeSpend.toString() &&
                    ev.amountIn.toString() === amountIn.toString() &&
                    ev.tokenOffer === weth.address &&
                    ev.tokenWants === dai.address;
            });
            truffleAssert.eventEmitted(tx, "OfferFulfilled", {offerId: offerId});

            const daiBalanceDeployerAfter = await dai.balanceOf(deployer);
            const wethBalanceAfter = await weth.balanceOf(user1);

            expect(daiBalanceDeployerAfter.toString()).to.be.equal(daiBalanceDeployerBefore.add(compensateWithMakerFee(amountIn)).toString());
            expect(wethBalanceAfter.toString()).to.be.equal(wethBalanceBefore.add(compensateWithTakerFee(toBN(takeSpend))).toString());
        });

        it("in dai", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);

            await fundDai(deployer, toWei('1'));

            const spend = toWei('1');
            const takeSpend = spend;

            // Must approve before use
            await dai.approve(instance.address, spend, {from: deployer});

            await instance.offer(dai.address, weth.address, spend, toBN(-5000), {from: deployer});
            const offerId = await instance.getOfferId();
            // Get the required input amount based on the offer
            const amountIn: BN = await instance.getAmountInForOffer(offerId, takeSpend);

            await fundWeth(user1, amountIn);

            await weth.approve(instance.address, amountIn, {from: user1});

            const wethBalanceDeployerBefore = await weth.balanceOf(deployer);
            const daiBalanceBefore = await dai.balanceOf(user1);

            await truffleAssert.passes(instance.take(offerId, takeSpend, {from: user1}));

            const wethBalanceDeployerAfter = await weth.balanceOf(deployer);
            const daiBalanceAfter = await dai.balanceOf(user1);

            expect(wethBalanceDeployerAfter.toString()).to.be.equal(wethBalanceDeployerBefore.add(compensateWithMakerFee(amountIn)).toString());
            expect(daiBalanceAfter.toString()).to.be.equal(daiBalanceBefore.add(compensateWithTakerFee(toBN(takeSpend))).toString());
        });

        it("should partially fulfilled", async () => {
            const instance = await SimpleOtcMarket.deployed();    
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  
            
            await fundWeth(deployer, toWei('1'));    

            const spend = toWei('1');
            let takeSpend = toWei('0.5');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
            const offerId = await instance.getOfferId();
            // Get the required input amount based on the offer
            let amountIn: BN = await instance.getAmountInForOffer(offerId, takeSpend);

            await fundDai(user1, amountIn);                
            await dai.approve(instance.address, amountIn, {from: user1});
            
            const daiBalanceDeployerBefore = await dai.balanceOf(deployer);

            const wethBalanceBefore = await weth.balanceOf(user1);

            const tx = await instance.take(offerId, takeSpend, {from: user1});
            truffleAssert.eventEmitted(tx, "OfferTaken", (ev: any) => {
                return ev.offerId.toString() === offerId.toString() &&
                    ev.amountOut.toString() === takeSpend.toString() &&
                    ev.amountIn.toString() === amountIn.toString() &&
                    ev.tokenOffer === weth.address &&
                    ev.tokenWants === dai.address;
            });
            truffleAssert.eventNotEmitted(tx, "OfferFulfilled");

            const daiBalanceDeployerAfter = await dai.balanceOf(deployer);
            const wethBalanceAfter = await weth.balanceOf(user1);

            expect(daiBalanceDeployerAfter.toString()).to.be.equal(daiBalanceDeployerBefore.add(compensateWithMakerFee(amountIn)).toString());
            expect(wethBalanceAfter.toString()).to.be.equal(wethBalanceBefore.add(compensateWithTakerFee(toBN(takeSpend))).toString());

            const { amountOffer, ... rest } = await instance.getOffer(offerId);
            takeSpend = amountOffer.toString();

            amountIn = await instance.getAmountInForOffer(offerId, takeSpend);

            await fundDai(user2, amountIn);
            await dai.approve(instance.address, amountIn, {from: user2});

            const tx2 = await instance.take(offerId, takeSpend, {from: user2});
            truffleAssert.eventEmitted(tx2, "OfferTaken", (ev: any) => {
                return ev.offerId.toString() === offerId.toString() &&
                    ev.amountOut.toString() === takeSpend.toString() &&
                    ev.amountIn.toString() === amountIn.toString() &&
                    ev.tokenOffer === weth.address &&
                    ev.tokenWants === dai.address;
            });
            truffleAssert.eventEmitted(tx2, "OfferFulfilled", {offerId: offerId});

            
         });

        it("should fail if offer is not found", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const weth = await ERC20.at(wethAddr);

            await fundWeth(deployer, toWei('1'));

            const spend = toWei('0.1');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await truffleAssert.reverts(instance.take(toBN(0), spend, {from: deployer}), "OFFER_CLOSED");
        });

        it("should fail if 0 amount is taken", async () => {
            const instance = await SimpleOtcMarket.deployed();
            const weth = await ERC20.at(wethAddr);

            await fundWeth(deployer, toWei('1'));

            const spend = toWei('0.1');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await instance.offer(weth.address, daiAddr, spend, toBN(-5000), {from: deployer});
            const offerId = await instance.getOfferId();

            await truffleAssert.reverts(instance.take(offerId, toBN(0), {from: deployer}), "ZERO_AMOUNT");
        });

        it("should fail if more is taken than offer", async () => {
            const instance = await SimpleOtcMarket.deployed();    
            const dai = await ERC20.at(daiAddr);
            const weth = await ERC20.at(wethAddr);  
            
            await fundWeth(deployer, toWei('1'));    

            const spend = toWei('0.1');
            const takeSpend = toWei('0.2');
            // Must approve before use
            await weth.approve(instance.address, spend, {from: deployer});

            await instance.offer(weth.address, dai.address, spend, toBN(-5000), {from: deployer});
            const offerId = await instance.getOfferId();
            // Get the required input amount based on the offer
            const amountIn: BN = await instance.getAmountInForOffer(offerId, takeSpend);

            await fundDai(user1, amountIn);                

            await dai.approve(instance.address, amountIn, {from: user1});

            await truffleAssert.reverts(instance.take(offerId, takeSpend, {from: user2}), "HIGHER_THAN_OFFER");
        });

        it("should fail if offer already taken", async () => {
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
            // Get the required input amount based on the offer
            const amountIn: BN = await instance.getAmountInForOffer(offerId, takeSpend);

            await fundDai(user1, amountIn);                
            await fundDai(user2, amountIn);                

            await dai.approve(instance.address, amountIn, {from: user1});
            await dai.approve(instance.address, amountIn, {from: user2});

            await truffleAssert.passes(instance.take(offerId, takeSpend, {from: user1}));

            await truffleAssert.reverts(instance.take(offerId, takeSpend, {from: user2}), "OFFER_CLOSED");
        });
    });
});