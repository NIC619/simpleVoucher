// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {VoucherBoard} from "../src/VoucherBoard.sol";

contract DeployVoucherBoard is Script {
    function run() public returns (address proxy, address implementation) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address simpleVoucherAddress = vm.envAddress("SIMPLE_VOUCHER_ADDRESS");

        console.log("Deployer:", deployer);
        console.log("SimpleVoucher:", simpleVoucherAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        VoucherBoard impl = new VoucherBoard();
        console.log("Implementation deployed at:", address(impl));

        // Encode initialization data
        bytes memory initData = abi.encodeCall(VoucherBoard.initialize, (deployer, simpleVoucherAddress));

        // Deploy proxy
        ERC1967Proxy proxyContract = new ERC1967Proxy(address(impl), initData);
        console.log("Proxy deployed at:", address(proxyContract));

        vm.stopBroadcast();

        return (address(proxyContract), address(impl));
    }
}
