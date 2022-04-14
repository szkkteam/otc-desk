// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;


/*

import '../interfaces/uniswap/IUniswapV2Pair.sol';
import '../interfaces/uniswap/IUniswapV2Router02.sol';
*/
import '../interfaces/uniswap/IUniswapV2Factory.sol';
import './UniswapV2Library.sol';
import '../interfaces/IPriceOracle.sol';

// TODO: Better oracle?
// https://github.com/Keydonix/uniswap-oracle/blob/master/contracts/source/UniswapOracle.sol
// https://soliditydeveloper.com/uniswap-oracle
// https://medium.com/@epheph/using-uniswap-v2-oracle-with-storage-proofs-3530e699e1d3

contract UniswapPriceOracle is IPriceOracle{

    address public factoryAddress;

    constructor(address _factory) {
        factoryAddress = _factory;
    }

    function getPair(address tokenA, address tokenB) public view virtual override returns (address pair) {
        return IUniswapV2Factory(factoryAddress).getPair(tokenA, tokenB);
    }

    function isPairExists(address tokenA, address tokenB) public view virtual override returns (bool) {
        return (IUniswapV2Factory(factoryAddress).getPair(tokenA, tokenB) != address(0));
    }

    function getPriceFor(address tokenA, address tokenB, uint256 amount) public view virtual override  returns (uint256) {
        (uint reserve0, uint reserve1) = UniswapV2Library.getReserves(factoryAddress, tokenA, tokenB);
        // TODO: compensate with fee (997) -> 003
        // TODO: use the getAmountOuts and construct a path with [0] = tokenOffer [1] = weth [2] = tokenWant to allow trading between non weth pairs

        uint256 res = UniswapV2Library.getAmountOut(amount, reserve0, reserve1);
        //uint256 res = reserve0 / reserve1;
        return res;

    }

}