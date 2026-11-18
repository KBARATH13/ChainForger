// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {BaseRBAC} from "./BaseRBAC.sol";

/**
 * @title CustomToken
 * @notice Parameterizable ERC20 token designed for private sandbox networks and BaaS deployments.
 * @dev Inherits OpenZeppelin ERC20, ERC20Burnable, and BaseRBAC for role-governed supply management.
 */
contract CustomToken is ERC20, ERC20Burnable, BaseRBAC {
    uint8 private immutable _decimals;

    event TokensMinted(address indexed to, uint256 amount, address indexed operator);

    /**
     * @param name_ Token Name (e.g. "ChainForger Enterprise Token")
     * @param symbol_ Token Symbol (e.g. "CFG")
     * @param decimals_ Custom Decimals (typically 18)
     * @param initialSupply Initial supply minted to recipient (in standard units before decimals scaling)
     * @param initialRecipient Address that receives the initial minted supply
     * @param admin Administrator and operator address
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply,
        address initialRecipient,
        address admin
    ) ERC20(name_, symbol_) BaseRBAC(admin) {
        _decimals = decimals_;

        if (initialSupply > 0) {
            address recipient = initialRecipient == address(0) ? (admin == address(0) ? msg.sender : admin) : initialRecipient;
            _mint(recipient, initialSupply * (10 ** uint256(decimals_)));
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint new tokens to target account.
     * @dev Restricted to addresses with OPERATOR_ROLE.
     */
    function mint(address to, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount, msg.sender);
    }
}

