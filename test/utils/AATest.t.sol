// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

abstract contract AATest is Test {
    address public constant ENTRY_POINT = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    IEntryPoint entryPoint;

    function setUp() public virtual {
        // Deploy EntryPoint at the canonical address using deployCodeTo
        // This properly initializes storage unlike vm.etch
        deployCodeTo("EntryPoint.sol:EntryPoint", ENTRY_POINT);
        entryPoint = IEntryPoint(ENTRY_POINT);
    }

    function _signUserOp(uint256 privateKey, PackedUserOperation memory userOp, address claimedSigner)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, entryPoint.getUserOpHash(userOp));
        return abi.encodePacked(r, s, v, claimedSigner);
    }

    function _buildUserOp(uint256 privateKey, address sender, bytes memory callData)
        internal
        view
        returns (PackedUserOperation memory)
    {
        PackedUserOperation memory userOp = _createUserOp();
        userOp.sender = sender;
        userOp.nonce = entryPoint.getNonce(sender, 0);
        userOp.callData = callData;
        userOp.signature = _signUserOp(privateKey, userOp, vm.addr(privateKey));
        return userOp;
    }

    function _buildUserOpWithoutSignature(address sender, bytes memory callData)
        internal
        view
        returns (PackedUserOperation memory)
    {
        PackedUserOperation memory userOp = _createUserOp();
        userOp.sender = sender;
        userOp.nonce = entryPoint.getNonce(sender, 0);
        userOp.callData = callData;
        return userOp;
    }

    function _handleUserOp(PackedUserOperation memory userOp) internal {
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;
        // EntryPoint v0.9 requires tx.origin == msg.sender && msg.sender has no code (EOA)
        // Use vm.prank to simulate an EOA bundler calling handleOps
        address bundler = address(0xBEEF);
        vm.prank(bundler, bundler); // prank both msg.sender and tx.origin
        entryPoint.handleOps(ops, payable(bundler));
    }

    function _createUserOp() internal pure returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: address(0),
            nonce: 0,
            initCode: bytes(""),
            callData: bytes(""),
            accountGasLimits: _pack(999_999, 999_999),
            preVerificationGas: 99_999,
            gasFees: _pack(999_999, 999_999),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }

    function _pack(uint256 a, uint256 b) internal pure returns (bytes32) {
        return bytes32((a << 128) | b);
    }
}
