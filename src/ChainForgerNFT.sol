// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {BaseRBAC} from "./BaseRBAC.sol";

/**
 * @title ChainForgerNFT
 * @notice Parameterizable ERC-721 contract supporting:
 *         1. STRICT_UNIQUE (1-of-1 assets: digital twins, certificates, property deeds)
 *         2. MULTI_MINT_SERIES (Editions with max supply caps per series)
 */
contract ChainForgerNFT is ERC721URIStorage, BaseRBAC {
    enum MintingPolicy {
        STRICT_UNIQUE,     // Only 1-of-1 items allowed
        MULTI_MINT_SERIES  // Multi-issue edition runs
    }

    MintingPolicy public immutable policy;
    uint256 public immutable maxSupply; // 0 = unlimited for multi-mint
    uint256 private _nextTokenId;

    event AssetMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        string tokenURI,
        address indexed operator
    );

    /**
     * @param name_ NFT Collection Name
     * @param symbol_ NFT Symbol
     * @param policy_ 0 for STRICT_UNIQUE, 1 for MULTI_MINT_SERIES
     * @param maxSupply_ Max total supply (ignored if STRICT_UNIQUE and 0)
     * @param admin Owner / Admin address
     */
    constructor(
        string memory name_,
        string memory symbol_,
        MintingPolicy policy_,
        uint256 maxSupply_,
        address admin
    ) ERC721(name_, symbol_) BaseRBAC(admin) {
        policy = policy_;
        maxSupply = maxSupply_;
        _nextTokenId = 1;
    }

    /**
     * @notice Mint a new token conforming to policy following CEI pattern (Checks-Effects-Interactions)
     * @param to Recipient wallet
     * @param uri Metadata URI for this token
     */
    function mintAsset(address to, string memory uri)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256)
    {
        // 1. CHECKS
        uint256 tokenId = _nextTokenId;

        if (policy == MintingPolicy.STRICT_UNIQUE) {
            if (maxSupply > 0 && tokenId > maxSupply) {
                revert("Max unique 1-of-1 supply cap reached");
            }
        } else if (policy == MintingPolicy.MULTI_MINT_SERIES) {
            if (maxSupply > 0 && tokenId > maxSupply) {
                revert("Series edition supply cap reached");
            }
        }

        // 2. EFFECTS (State updates & event emission before external interaction)
        _nextTokenId++;
        emit AssetMinted(tokenId, to, uri, msg.sender);

        // 3. INTERACTIONS (Token URI storage & safe minting which performs external call to receiver)
        _setTokenURI(tokenId, uri);
        _safeMint(to, tokenId);

        return tokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ==========================================
    // Solidity Multiple-Inheritance Overrides
    // ==========================================

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
