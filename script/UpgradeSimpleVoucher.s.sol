// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimpleVoucher} from "../src/SimpleVoucher.sol";

contract UpgradeSimpleVoucher is Script {
    function run() public returns (address newImplementation) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAddress = vm.envAddress("SIMPLE_VOUCHER_ADDRESS");

        console.log("Deployer:", deployer);
        console.log("Proxy:", proxyAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        SimpleVoucher newImpl = new SimpleVoucher();
        console.log("New implementation deployed at:", address(newImpl));

        // Upgrade proxy to new implementation
        SimpleVoucher proxy = SimpleVoucher(proxyAddress);
        proxy.upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded successfully");

        vm.stopBroadcast();

        return address(newImpl);
    }
}
