// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IPriceOracle {

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function isPairExists(address tokenA, address tokenB) external view returns (bool);
    function getPriceFor(address tokenA, address tokenB, uint256 amount) external view returns (uint256);
}