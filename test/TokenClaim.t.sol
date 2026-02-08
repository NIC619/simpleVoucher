// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SimpleVoucher} from "../src/SimpleVoucher.sol";
import {DemoToken} from "../src/DemoToken.sol";
import {TokenClaim} from "../src/TokenClaim.sol";

contract TokenClaimTest is Test {
    SimpleVoucher public voucherContract;
    DemoToken public demoToken;
    TokenClaim public tokenClaim;

    address public owner = makeAddr("owner");
    address public issuer = makeAddr("issuer");
    address public recipient = makeAddr("recipient");

    string public constant TOPIC = "test-topic";
    bytes32 public topicHash;
    uint256 public constant CLAIM_AMOUNT = 100 ether;

    event TokenClaimed(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed topicHash,
        bytes32 indexed voucherHash
    );

    function setUp() public {
        topicHash = keccak256(abi.encodePacked(TOPIC));

        // Deploy SimpleVoucher (upgradeable proxy)
        SimpleVoucher impl = new SimpleVoucher();
        bytes memory initData = abi.encodeCall(SimpleVoucher.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        voucherContract = SimpleVoucher(address(proxy));

        // Deploy DemoToken
        demoToken = new DemoToken();

        // Deploy TokenClaim
        tokenClaim = new TokenClaim(owner, address(voucherContract), address(demoToken), CLAIM_AMOUNT);
    }

    function _issueBindingVoucher(uint256 privateKey) internal returns (address voucherAddr, bytes32 voucherHash) {
        voucherAddr = vm.addr(privateKey);
        voucherHash = keccak256(abi.encodePacked(voucherAddr));

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = voucherHash;

        vm.prank(issuer);
        voucherContract.issueBasicVouchers(TOPIC, hashes);
    }

    function _signRecipient(uint256 privateKey, address recipient_) internal pure returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked(recipient_));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_ClaimToken() public {
        uint256 privateKey = 0xBEEF;
        (, bytes32 voucherHash) = _issueBindingVoucher(privateKey);
        bytes memory signature = _signRecipient(privateKey, recipient);

        vm.expectEmit(true, true, true, true);
        emit TokenClaimed(recipient, CLAIM_AMOUNT, topicHash, voucherHash);

        tokenClaim.claimToken(issuer, TOPIC, recipient, signature);

        // Verify tokens received
        assertEq(demoToken.balanceOf(recipient), CLAIM_AMOUNT);

        // Verify voucher redeemed
        assertEq(
            uint256(voucherContract.vouchers(issuer, topicHash, voucherHash)),
            uint256(SimpleVoucher.Status.Redeemed)
        );
    }

    function test_ClaimToken_RevertOnNonexistent() public {
        uint256 privateKey = 0xBEEF;
        bytes32 voucherHash = keccak256(abi.encodePacked(vm.addr(privateKey)));
        bytes memory signature = _signRecipient(privateKey, recipient);

        vm.expectRevert(abi.encodeWithSelector(SimpleVoucher.VoucherDoesNotExist.selector, voucherHash));
        tokenClaim.claimToken(issuer, TOPIC, recipient, signature);
    }

    function test_ClaimToken_RevertOnAlreadyRedeemed() public {
        uint256 privateKey = 0xBEEF;
        (, bytes32 voucherHash) = _issueBindingVoucher(privateKey);
        bytes memory signature = _signRecipient(privateKey, recipient);

        // First claim succeeds
        tokenClaim.claimToken(issuer, TOPIC, recipient, signature);

        // Second claim reverts
        vm.expectRevert(abi.encodeWithSelector(SimpleVoucher.VoucherAlreadyRedeemed.selector, voucherHash));
        tokenClaim.claimToken(issuer, TOPIC, recipient, signature);
    }

    function test_ClaimToken_RevertOnWrongKey() public {
        uint256 correctKey = 0xBEEF;
        uint256 wrongKey = 0xDEAD;
        _issueBindingVoucher(correctKey);

        // Sign with wrong key
        bytes memory signature = _signRecipient(wrongKey, recipient);

        address wrongAddr = vm.addr(wrongKey);
        bytes32 wrongHash = keccak256(abi.encodePacked(wrongAddr));

        vm.expectRevert(abi.encodeWithSelector(SimpleVoucher.VoucherDoesNotExist.selector, wrongHash));
        tokenClaim.claimToken(issuer, TOPIC, recipient, signature);
    }

    function test_ClaimToken_RevertOnWrongRecipient() public {
        uint256 privateKey = 0xBEEF;
        _issueBindingVoucher(privateKey);

        address wrongRecipient = makeAddr("wrongRecipient");

        // Sign for the correct recipient
        bytes memory signature = _signRecipient(privateKey, recipient);

        // But claim for wrongRecipient — ECDSA recovery yields different signer
        // The recovered signer won't match any issued voucher
        vm.expectRevert();
        tokenClaim.claimToken(issuer, TOPIC, wrongRecipient, signature);
    }

    function test_SetClaimAmount() public {
        uint256 newAmount = 200 ether;

        vm.prank(owner);
        tokenClaim.setClaimAmount(newAmount);

        assertEq(tokenClaim.claimAmount(), newAmount);
    }

    function test_SetClaimAmount_RevertOnNonOwner() public {
        vm.prank(makeAddr("nonOwner"));
        vm.expectRevert();
        tokenClaim.setClaimAmount(200 ether);
    }

    function test_SetToken() public {
        address newToken = makeAddr("newToken");

        vm.prank(owner);
        tokenClaim.setToken(newToken);

        assertEq(address(tokenClaim.token()), newToken);
    }

    function test_SetToken_RevertOnNonOwner() public {
        vm.prank(makeAddr("nonOwner"));
        vm.expectRevert();
        tokenClaim.setToken(makeAddr("newToken"));
    }

    function test_SetSimpleVoucher() public {
        address newVoucher = makeAddr("newVoucher");

        vm.prank(owner);
        tokenClaim.setSimpleVoucher(newVoucher);

        assertEq(address(tokenClaim.simpleVoucher()), newVoucher);
    }

    function test_SetSimpleVoucher_RevertOnNonOwner() public {
        vm.prank(makeAddr("nonOwner"));
        vm.expectRevert();
        tokenClaim.setSimpleVoucher(makeAddr("newVoucher"));
    }
}
