// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SimpleVoucher} from "../src/SimpleVoucher.sol";
import {VoucherBoard} from "../src/VoucherBoard.sol";
import {VoucherBoardProxy} from "../src/VoucherBoardProxy.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import "./utils/AATest.t.sol";

contract VoucherBoardTest is AATest {
    SimpleVoucher public simpleVoucher;
    VoucherBoard public voucherBoard;

    address public owner;
    uint256 public ownerKey;
    address public issuer = address(2);

    string public topic = "test-topic";
    bytes32 public voucher1 = keccak256("voucher1");
    bytes32 public voucher2 = keccak256("voucher2");
    bytes32 public voucherHash1;
    bytes32 public voucherHash2;

    event MessagePosted(
        address indexed issuer,
        string topic,
        bytes32 indexed voucherHash,
        string message
    );

    function setUp() public override {
        super.setUp();

        (owner, ownerKey) = makeAddrAndKey("owner");

        voucherHash1 = keccak256(abi.encodePacked(voucher1));
        voucherHash2 = keccak256(abi.encodePacked(voucher2));

        // Deploy SimpleVoucher
        SimpleVoucher simpleVoucherImpl = new SimpleVoucher();
        bytes memory simpleVoucherData = abi.encodeWithSelector(
            SimpleVoucher.initialize.selector,
            owner
        );
        ERC1967Proxy simpleVoucherProxy = new ERC1967Proxy(
            address(simpleVoucherImpl),
            simpleVoucherData
        );
        simpleVoucher = SimpleVoucher(address(simpleVoucherProxy));

        // Deploy VoucherBoard
        VoucherBoard voucherBoardImpl = new VoucherBoard();
        bytes memory voucherBoardData = abi.encodeWithSelector(
            VoucherBoard.initialize.selector,
            owner,
            address(simpleVoucher)
        );
        VoucherBoardProxy voucherBoardProxy = new VoucherBoardProxy(
            address(voucherBoardImpl),
            voucherBoardData
        );
        voucherBoard = VoucherBoard(payable(address(voucherBoardProxy)));

        // Fund VoucherBoard for gas
        vm.deal(address(voucherBoard), 10 ether);

        // Issue vouchers
        bytes32[] memory voucherHashes = new bytes32[](2);
        voucherHashes[0] = voucherHash1;
        voucherHashes[1] = voucherHash2;

        vm.prank(issuer);
        simpleVoucher.issueBasicVouchers(topic, voucherHashes);
    }

    /* -------------------------------------------------------------------------- */
    /*                              E2E Tests (4337)                              */
    /* -------------------------------------------------------------------------- */

    function test_PostMessage_E2E() public {
        string memory message = "Hello from anonymous user!";

        // Build UserOp for postMessage
        PackedUserOperation memory userOp = _buildUserOpWithoutSignature(
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.postMessage, (issuer, topic, voucher1, message))
        );
        // No signature needed - voucher acts as authorization
        userOp.signature = bytes("");

        // Expect the MessagePosted event
        vm.expectEmit(true, false, true, true);
        emit MessagePosted(issuer, topic, voucherHash1, message);

        // Execute via EntryPoint
        _handleUserOp(userOp);

        // Verify voucher is now redeemed in SimpleVoucher
        SimpleVoucher.Status status = simpleVoucher.getVoucherStatus(
            issuer,
            topic,
            voucherHash1
        );
        assertEq(uint8(status), uint8(SimpleVoucher.Status.Redeemed));
    }

    function test_PostMessage_MultiplePosts_E2E() public {
        // First message
        PackedUserOperation memory userOp1 = _buildUserOpWithoutSignature(
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.postMessage, (issuer, topic, voucher1, "First message"))
        );
        userOp1.signature = bytes("");
        _handleUserOp(userOp1);

        // Second message with different voucher
        PackedUserOperation memory userOp2 = _buildUserOpWithoutSignature(
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.postMessage, (issuer, topic, voucher2, "Second message"))
        );
        userOp2.signature = bytes("");
        _handleUserOp(userOp2);

        // Both vouchers should be redeemed
        assertEq(
            uint8(simpleVoucher.getVoucherStatus(issuer, topic, voucherHash1)),
            uint8(SimpleVoucher.Status.Redeemed)
        );
        assertEq(
            uint8(simpleVoucher.getVoucherStatus(issuer, topic, voucherHash2)),
            uint8(SimpleVoucher.Status.Redeemed)
        );
    }

    function test_PostMessage_RevertIfVoucherAlreadyRedeemed_E2E() public {
        // First post succeeds
        PackedUserOperation memory userOp1 = _buildUserOpWithoutSignature(
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.postMessage, (issuer, topic, voucher1, "First"))
        );
        userOp1.signature = bytes("");
        _handleUserOp(userOp1);

        // Second post with same voucher should fail validation
        PackedUserOperation memory userOp2 = _buildUserOpWithoutSignature(
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.postMessage, (issuer, topic, voucher1, "Second"))
        );
        userOp2.signature = bytes("");

        vm.expectRevert(); // AA24 signature error - validation failed
        _handleUserOp(userOp2);
    }

    function test_PostMessage_RevertIfVoucherDoesNotExist_E2E() public {
        bytes32 invalidVoucher = keccak256("invalid");

        PackedUserOperation memory userOp = _buildUserOpWithoutSignature(
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.postMessage, (issuer, topic, invalidVoucher, "Message"))
        );
        userOp.signature = bytes("");

        vm.expectRevert(); // AA24 signature error - validation failed
        _handleUserOp(userOp);
    }

    function test_Withdraw_E2E() public {
        uint256 ownerBalanceBefore = owner.balance;

        // Build UserOp for withdraw (requires owner signature)
        PackedUserOperation memory userOp = _buildUserOp(
            ownerKey,
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.withdraw, (0.5 ether))
        );

        _handleUserOp(userOp);

        assertEq(owner.balance, ownerBalanceBefore + 0.5 ether);
    }

    function test_Withdraw_RevertIfNotOwner_E2E() public {
        (, uint256 fakeKey) = makeAddrAndKey("fake");

        PackedUserOperation memory userOp = _buildUserOp(
            fakeKey,
            address(voucherBoard),
            abi.encodeCall(VoucherBoard.withdraw, (0.5 ether))
        );

        vm.expectRevert(); // AA24 signature error
        _handleUserOp(userOp);
    }

    /* -------------------------------------------------------------------------- */
    /*                              Unit Tests                                    */
    /* -------------------------------------------------------------------------- */

    function test_PostMessage_RevertIfNotEntryPoint() public {
        vm.expectRevert(VoucherBoard.NotFromEntryPoint.selector);
        voucherBoard.postMessage(issuer, topic, voucher1, "Hello");
    }

    function test_Withdraw_DirectCall() public {
        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        voucherBoard.withdraw(0.5 ether);

        assertEq(owner.balance, ownerBalanceBefore + 0.5 ether);
    }

    function test_Withdraw_RevertIfNotOwnerDirect() public {
        vm.expectRevert();
        voucherBoard.withdraw(0.5 ether);
    }

    function test_SetSimpleVoucher() public {
        address newSimpleVoucher = address(100);

        vm.prank(owner);
        voucherBoard.setSimpleVoucher(newSimpleVoucher);

        assertEq(address(voucherBoard.simpleVoucher()), newSimpleVoucher);
    }

    function test_ReceiveEther() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(voucherBoard).call{value: 0.5 ether}("");

        assertTrue(success);
    }
}
