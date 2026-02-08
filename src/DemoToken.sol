// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title DemoToken
 * @notice A simple ERC20 token with open mint for demo purposes
 */
contract DemoToken is ERC20 {
    constructor() ERC20("Simple Voucher Demo Token", "SV") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
