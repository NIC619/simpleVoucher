// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface ISimpleVoucher {
    enum Status { Nonexist, Issued, Redeemed }
    function getVoucherStatus(address issuer, string calldata topic, bytes32 voucherHash) external view returns (Status);
    function redeemVoucher(address issuer, string calldata topic, bytes32 voucher) external;
}

/**
 * @title VoucherBoard
 * @notice A bulletin board where voucher holders can post messages anonymously via ERC-4337
 * @dev This contract is an ERC-4337 smart account - posting via UserOp hides the sender's address
 */
contract VoucherBoard is UUPSUpgradeable, OwnableUpgradeable, IAccount {
    uint256 public constant SIG_VALIDATION_FAILED = 1;

    /// @notice The SimpleVoucher contract reference
    ISimpleVoucher public simpleVoucher;

    /// @notice Emitted when a message is posted
    event MessagePosted(
        address indexed issuer,
        string topic,
        bytes32 indexed voucherHash,
        string message
    );

    /// @notice Error when caller is not EntryPoint
    error NotFromEntryPoint();

    /// @notice Error when function selector is not supported
    error UnsupportedSelector(bytes4 selector);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    receive() external payable {}

    /**
     * @notice Initializes the contract
     * @param owner_ The owner of the contract (can upgrade and withdraw)
     * @param simpleVoucher_ The SimpleVoucher contract address
     */
    function initialize(address owner_, address simpleVoucher_) public initializer {
        __Ownable_init(owner_);
        simpleVoucher = ISimpleVoucher(simpleVoucher_);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Modifiers                                 */
    /* -------------------------------------------------------------------------- */

    modifier onlyOwnerOrEntryPoint() {
        require(msg.sender == owner() || msg.sender == entryPoint(), "Unauthorized");
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint()) {
            revert NotFromEntryPoint();
        }
        _;
    }

    /// @dev Sends to the EntryPoint the missing funds for this transaction
    modifier payPrefund(uint256 missingAccountFunds) {
        _;
        assembly {
            if missingAccountFunds {
                pop(call(gas(), caller(), missingAccountFunds, codesize(), 0x00, codesize(), 0x00))
            }
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                    Owner                                   */
    /* -------------------------------------------------------------------------- */

    function _authorizeUpgrade(address newImplementation) internal override onlyOwnerOrEntryPoint {}

    /// @notice Withdraw ETH from the contract (for gas funding)
    function withdraw(uint256 amount) external onlyOwnerOrEntryPoint {
        (bool success,) = owner().call{value: amount}("");
        require(success, "Withdraw failed");
    }

    /// @notice Update the SimpleVoucher contract reference
    function setSimpleVoucher(address simpleVoucher_) external onlyOwnerOrEntryPoint {
        simpleVoucher = ISimpleVoucher(simpleVoucher_);
    }

    /* -------------------------------------------------------------------------- */
    /*                               Post Message                                 */
    /* -------------------------------------------------------------------------- */

    /**
     * @notice Post a message anonymously via ERC-4337
     * @dev Can only be called by EntryPoint after validateUserOp succeeds
     * @param issuer The voucher issuer address
     * @param topic The topic string
     * @param voucher The raw voucher value
     * @param message The message to post
     */
    function postMessage(
        address issuer,
        string calldata topic,
        bytes32 voucher,
        string calldata message
    ) external onlyEntryPoint {
        // Redeem the voucher (this will revert if invalid or already redeemed)
        simpleVoucher.redeemVoucher(issuer, topic, voucher);

        // Emit the message
        bytes32 voucherHash = keccak256(abi.encodePacked(voucher));
        emit MessagePosted(issuer, topic, voucherHash, message);
    }

    /* -------------------------------------------------------------------------- */
    /*                              ERC-4337 Account                              */
    /* -------------------------------------------------------------------------- */

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint payPrefund(missingAccountFunds) returns (uint256 validationData) {
        bytes4 selector = bytes4(userOp.callData[0:4]);

        // Anonymous message posting - voucher acts as authorization
        if (selector == this.postMessage.selector) {
            (address issuer, string memory topic, bytes32 voucher,) =
                abi.decode(userOp.callData[4:], (address, string, bytes32, string));

            // Verify voucher is valid (Issued status)
            bytes32 voucherHash = keccak256(abi.encodePacked(voucher));
            ISimpleVoucher.Status status = simpleVoucher.getVoucherStatus(issuer, topic, voucherHash);

            if (status != ISimpleVoucher.Status.Issued) {
                return SIG_VALIDATION_FAILED;
            }

            return 0; // Success - voucher is valid
        }

        // Owner operations require signature verification
        if (
            selector == this.upgradeToAndCall.selector ||
            selector == this.withdraw.selector ||
            selector == this.setSimpleVoucher.selector
        ) {
            // Signature format: 65 bytes signature + 20 bytes signer address
            if (userOp.signature.length != 85) {
                return SIG_VALIDATION_FAILED;
            }

            bytes memory actualSignature = userOp.signature[:65];
            address appendedSigner = address(bytes20(userOp.signature[65:]));
            address signer = ECDSA.recover(userOpHash, actualSignature);

            if (appendedSigner != owner() || signer != appendedSigner) {
                return SIG_VALIDATION_FAILED;
            }

            return 0;
        }

        revert UnsupportedSelector(selector);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    View                                    */
    /* -------------------------------------------------------------------------- */

    /// @notice Returns the EntryPoint v0.8 address
    function entryPoint() public pure returns (address) {
        return 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;
    }
}
