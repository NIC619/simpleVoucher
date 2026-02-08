// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TokenClaim} from "../src/TokenClaim.sol";

contract DeployTokenClaim is Script {
    function run() public returns (address tokenClaim) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address simpleVoucherAddress = vm.envAddress("SIMPLE_VOUCHER_ADDRESS");
        address demoTokenAddress = vm.envAddress("DEMO_TOKEN_ADDRESS");
        uint256 claimAmount = vm.envUint("CLAIM_AMOUNT");

        console.log("Deployer:", deployer);
        console.log("SimpleVoucher:", simpleVoucherAddress);
        console.log("DemoToken:", demoTokenAddress);
        console.log("ClaimAmount:", claimAmount);

        vm.startBroadcast(deployerPrivateKey);

        TokenClaim claim = new TokenClaim(deployer, simpleVoucherAddress, demoTokenAddress, claimAmount);
        console.log("TokenClaim deployed at:", address(claim));

        vm.stopBroadcast();

        return address(claim);
    }
}
