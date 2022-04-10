// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import '../interfaces/uniswap/IUniswapV2Factory.sol';
import '../interfaces/uniswap/IUniswapV2Pair.sol';
import '../interfaces/uniswap/IUniswapV2Router02.sol';


contract UniswapPriceOracle {

    address public factoryAddress;
    address public routerAddress;

    constructor(address _factory, address _router) {
        factoryAddress = _factory;
        routerAddress = _router;
    }

    function getPriceFor(address tokenA, address tokenB, uint256 amount) external view returns (uint256) {
        (uint reserve0, uint reserve1, ) = IUniswapV2Pair(IUniswapV2Factory(factoryAddress).getPair(tokenA, tokenB)).getReserves();
        return IUniswapV2Router02(routerAddress).getAmountOut(amount, reserve0, reserve1);
    }
}