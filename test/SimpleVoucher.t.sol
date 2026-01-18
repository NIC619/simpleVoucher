// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SimpleVoucher} from "../src/SimpleVoucher.sol";

contract SimpleVoucherTest is Test {
    SimpleVoucher public voucherContract;
    SimpleVoucher public implementation;

    address public owner = makeAddr("owner");
    address public issuer = makeAddr("issuer");
    address public redeemer = makeAddr("redeemer");

    string public constant TOPIC = "test-topic";
    bytes32 public topicHash;

    event VouchersIssued(
        address indexed issuer,
        string topic,
        bytes32 indexed topicHash
    );

    event VoucherIssued(
        address indexed issuer,
        bytes32 indexed topicHash,
        bytes32 indexed voucherHash
    );

    event VoucherRedeemed(
        address indexed issuer,
        address indexed redeemer,
        bytes32 indexed topicHash,
        bytes32 voucherHash
    );

    function setUp() public {
        topicHash = keccak256(abi.encodePacked(TOPIC));

        // Deploy implementation
        implementation = new SimpleVoucher();

        // Deploy proxy
        bytes memory initData = abi.encodeCall(SimpleVoucher.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        voucherContract = SimpleVoucher(address(proxy));
    }

    function _hashVoucher(bytes32 voucher) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(voucher));
    }

    function test_Initialize() public view {
        assertEq(voucherContract.owner(), owner);
    }

    function test_IssueBasicVouchers() public {
        // Raw voucher values
        bytes32 voucher1 = bytes32("voucher1");
        bytes32 voucher2 = bytes32("voucher2");
        bytes32 voucher3 = bytes32("voucher3");

        // Hash them for issuing
        bytes32[] memory hashes = new bytes32[](3);
        hashes[0] = _hashVoucher(voucher1);
        hashes[1] = _hashVoucher(voucher2);
        hashes[2] = _hashVoucher(voucher3);

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);

        // Check all vouchers are issued
        for (uint256 i = 0; i < hashes.length; i++) {
            assertEq(
                uint256(voucherContract.vouchers(issuer, topicHash, hashes[i])),
                uint256(SimpleVoucher.Status.Issued)
            );
        }
    }

    function test_IssueBasicVouchers_EmitsEvents() public {
        bytes32 voucher1 = bytes32("voucher1");
        bytes32 voucher2 = bytes32("voucher2");

        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = _hashVoucher(voucher1);
        hashes[1] = _hashVoucher(voucher2);

        vm.expectEmit(true, true, true, false);
        emit VoucherIssued(issuer, topicHash, hashes[0]);

        vm.expectEmit(true, true, true, false);
        emit VoucherIssued(issuer, topicHash, hashes[1]);

        vm.expectEmit(true, true, true, true);
        emit VouchersIssued(issuer, TOPIC, topicHash);

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);
    }

    function test_IssueBasicVouchers_RevertOnEmpty() public {
        bytes32[] memory hashes = new bytes32[](0);

        vm.prank(issuer);
        vm.expectRevert(SimpleVoucher.EmptyVoucherHashes.selector);
        voucherContract.issueBasicVouchers(TOPIC, hashes);
    }

    function test_IssueBasicVouchers_RevertOnDuplicate() public {
        bytes32 voucher1 = bytes32("voucher1");
        bytes32 voucherHash = _hashVoucher(voucher1);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);

        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(SimpleVoucher.VoucherAlreadyExists.selector, voucherHash));
        voucherContract.issueBasicVouchers(TOPIC, hashes);
    }

    function test_RedeemVoucher() public {
        bytes32 rawVoucher = bytes32("voucher1");
        bytes32 voucherHash = _hashVoucher(rawVoucher);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);

        // Redeem with raw voucher value
        vm.prank(redeemer);
        voucherContract.redeemVoucher(issuer, TOPIC, rawVoucher);

        assertEq(
            uint256(voucherContract.vouchers(issuer, topicHash, voucherHash)),
            uint256(SimpleVoucher.Status.Redeemed)
        );
    }

    function test_RedeemVoucher_EmitsEvent() public {
        bytes32 rawVoucher = bytes32("voucher1");
        bytes32 voucherHash = _hashVoucher(rawVoucher);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);

        vm.expectEmit(true, true, true, true);
        emit VoucherRedeemed(issuer, redeemer, topicHash, voucherHash);

        vm.prank(redeemer);
        voucherContract.redeemVoucher(issuer, TOPIC, rawVoucher);
    }

    function test_RedeemVoucher_RevertOnNonexistent() public {
        bytes32 fakeVoucher = bytes32("fake");
        bytes32 fakeHash = _hashVoucher(fakeVoucher);

        vm.prank(redeemer);
        vm.expectRevert(abi.encodeWithSelector(SimpleVoucher.VoucherDoesNotExist.selector, fakeHash));
        voucherContract.redeemVoucher(issuer, TOPIC, fakeVoucher);
    }

    function test_RedeemVoucher_RevertOnAlreadyRedeemed() public {
        bytes32 rawVoucher = bytes32("voucher1");
        bytes32 voucherHash = _hashVoucher(rawVoucher);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);

        vm.prank(redeemer);
        voucherContract.redeemVoucher(issuer, TOPIC, rawVoucher);

        vm.prank(redeemer);
        vm.expectRevert(abi.encodeWithSelector(SimpleVoucher.VoucherAlreadyRedeemed.selector, voucherHash));
        voucherContract.redeemVoucher(issuer, TOPIC, rawVoucher);
    }

    function test_GetVoucherStatus() public {
        bytes32 rawVoucher = bytes32("voucher1");
        bytes32 voucherHash = _hashVoucher(rawVoucher);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        // Check nonexistent
        assertEq(
            uint256(voucherContract.getVoucherStatus(issuer, TOPIC, voucherHash)),
            uint256(SimpleVoucher.Status.Nonexist)
        );

        // Issue and check issued
        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);
        assertEq(
            uint256(voucherContract.getVoucherStatus(issuer, TOPIC, voucherHash)),
            uint256(SimpleVoucher.Status.Issued)
        );

        // Redeem and check redeemed
        vm.prank(redeemer);
        voucherContract.redeemVoucher(issuer, TOPIC, rawVoucher);
        assertEq(
            uint256(voucherContract.getVoucherStatus(issuer, TOPIC, voucherHash)),
            uint256(SimpleVoucher.Status.Redeemed)
        );
    }

    function test_DifferentIssuersCanUseSameVoucherHash() public {
        address issuer2 = makeAddr("issuer2");

        bytes32 rawVoucher = bytes32("voucher1");
        bytes32 voucherHash = _hashVoucher(rawVoucher);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);

        vm.prank(issuer2);
        voucherContract.issueBasicVouchers(TOPIC, hashes);

        // Both should be issued under their respective issuers
        assertEq(
            uint256(voucherContract.vouchers(issuer, topicHash, voucherHash)),
            uint256(SimpleVoucher.Status.Issued)
        );
        assertEq(
            uint256(voucherContract.vouchers(issuer2, topicHash, voucherHash)),
            uint256(SimpleVoucher.Status.Issued)
        );
    }

    function test_DifferentTopicsCanUseSameVoucherHash() public {
        string memory topic2 = "another-topic";

        bytes32 rawVoucher = bytes32("voucher1");
        bytes32 voucherHash = _hashVoucher(rawVoucher);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.startPrank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);
        voucherContract.issueBasicVouchers(topic2, hashes);
        vm.stopPrank();

        // Both should be issued under their respective topics
        assertEq(
            uint256(voucherContract.getVoucherStatus(issuer, TOPIC, voucherHash)),
            uint256(SimpleVoucher.Status.Issued)
        );
        assertEq(
            uint256(voucherContract.getVoucherStatus(issuer, topic2, voucherHash)),
            uint256(SimpleVoucher.Status.Issued)
        );
    }

    function testFuzz_IssueAndRedeem(bytes32 rawVoucher, string calldata topic) public {
        vm.assume(bytes(topic).length > 0);

        bytes32 voucherHash = _hashVoucher(rawVoucher);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(topic, hashes);

        vm.prank(redeemer);
        voucherContract.redeemVoucher(issuer, topic, rawVoucher);

        bytes32 computedTopicHash = keccak256(abi.encodePacked(topic));
        assertEq(
            uint256(voucherContract.vouchers(issuer, computedTopicHash, voucherHash)),
            uint256(SimpleVoucher.Status.Redeemed)
        );
    }
}
