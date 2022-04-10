// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IPriceOracle {

    function getPriceFor(address tokenA, address tokenB, uint256 amount) external view returns (uint256);
}