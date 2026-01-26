// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {VoucherBoard} from "../src/VoucherBoard.sol";
import {VoucherBoardProxy} from "../src/VoucherBoardProxy.sol";

contract DeployVoucherBoard is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address simpleVoucherAddress = vm.envAddress("SIMPLE_VOUCHER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        VoucherBoard implementation = new VoucherBoard();

        // Deploy proxy
        address owner = vm.addr(deployerPrivateKey);
        bytes memory initData = abi.encodeWithSelector(
            VoucherBoard.initialize.selector,
            owner,
            simpleVoucherAddress
        );
        VoucherBoardProxy proxy = new VoucherBoardProxy(
            address(implementation),
            initData
        );

        vm.stopBroadcast();
    }
}
