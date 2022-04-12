// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;


import "../contracts/SimpleOtcMarket.sol";
import '../contracts/interfaces/IERC20.sol';

contract MarketUser {
    address market;

    constructor(address _market) {
        market = _market;
    }

    function doApprove(IERC20 token, address spender, uint256 amount) public {
        token.approve(spender, amount);
    }

    function doBuy(uint256 offerId, uint256 amount) public returns (bool){
        return SimpleOtcMarket(market).take(offerId, amount);
    }
}

