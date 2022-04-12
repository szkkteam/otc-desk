// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

/*
import '../interfaces/uniswap/IUniswapV2Factory.sol';
import '../interfaces/uniswap/IUniswapV2Pair.sol';
import '../interfaces/uniswap/IUniswapV2Router02.sol';
*/
import './UniswapV2Library.sol';
import '../interfaces/IPriceOracle.sol';

contract UniswapPriceOracle is IPriceOracle{

    address public factoryAddress;

    constructor(address _factory) {
        factoryAddress = _factory;
    }

    function getPriceFor(address tokenA, address tokenB, uint256 amount) public view virtual override  returns (uint256) {
        (uint reserve0, uint reserve1) = UniswapV2Library.getReserves(factoryAddress, tokenA, tokenB);
        // TODO: compensate with fee (997) -> 003
        // TODO: use the getAmountOuts and construct a path with [0] = tokenOffer [1] = weth [2] = tokenWant to allow trading between non weth pairs

        uint256 res = UniswapV2Library.getAmountOut(amount, reserve0, reserve1);
        return res;

    }

}