// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface ISimpleVoucher {
    function redeemBindingVoucher(
        address issuer,
        string calldata topic,
        bytes32 digest,
        bytes calldata signature
    ) external;
}

interface IDemoToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title TokenClaim
 * @notice Claim ERC20 tokens using a binding voucher
 */
contract TokenClaim is Ownable {
    ISimpleVoucher public simpleVoucher;
    IDemoToken public token;
    uint256 public claimAmount;

    event TokenClaimed(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed topicHash,
        bytes32 indexed voucherHash
    );

    constructor(
        address owner_,
        address simpleVoucher_,
        address token_,
        uint256 claimAmount_
    ) Ownable(owner_) {
        simpleVoucher = ISimpleVoucher(simpleVoucher_);
        token = IDemoToken(token_);
        claimAmount = claimAmount_;
    }

    /**
     * @notice Claim tokens using a binding voucher
     * @param issuer The address that issued the voucher
     * @param topic The topic string the voucher was issued under
     * @param recipient The address to receive tokens
     * @param signature The signature produced by the voucher's private key over keccak256(abi.encodePacked(recipient))
     */
    function claimToken(
        address issuer,
        string calldata topic,
        address recipient,
        bytes calldata signature
    ) external {
        bytes32 digest = keccak256(abi.encodePacked(recipient));
        address signer = ECDSA.recover(digest, signature);
        bytes32 voucherHash = keccak256(abi.encodePacked(signer));
        simpleVoucher.redeemBindingVoucher(issuer, topic, digest, signature);
        token.mint(recipient, claimAmount);
        emit TokenClaimed(recipient, claimAmount, keccak256(abi.encodePacked(topic)), voucherHash);
    }

    function setClaimAmount(uint256 claimAmount_) external onlyOwner {
        claimAmount = claimAmount_;
    }

    function setSimpleVoucher(address simpleVoucher_) external onlyOwner {
        simpleVoucher = ISimpleVoucher(simpleVoucher_);
    }

    function setToken(address token_) external onlyOwner {
        token = IDemoToken(token_);
    }
}
