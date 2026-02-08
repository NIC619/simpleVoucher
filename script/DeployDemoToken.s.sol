// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {DemoToken} from "../src/DemoToken.sol";

contract DeployDemoToken is Script {
    function run() public returns (address token) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        DemoToken demoToken = new DemoToken();
        console.log("DemoToken deployed at:", address(demoToken));

        vm.stopBroadcast();

        return address(demoToken);
    }
}
