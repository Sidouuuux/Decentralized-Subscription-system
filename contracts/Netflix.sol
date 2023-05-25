// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

/// @title Netflix Subscription Contract
/// @dev This contract implements the functionality to subscribe to different types of (Netflix) subscriptions, manage subscription details, and transfer subscription tokens.
contract Netflix is ERC1155, Ownable, Pausable, ERC1155Supply {
    struct Subscription {
        uint256 subId;
        address owner;
        uint256 maxUsers;
        address[] usersAllowed;
        uint256 expirationDate;
    }

    event SubscriptionPurchased(
        address indexed owner,
        uint256 indexed subId,
        uint256 indexed subscriptionType,
        uint256 duration
    );

    event UserAddedToAllowedList(
        address indexed owner,
        uint256 indexed subId,
        address indexed user
    );

    event TokenTransferred(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount
    );

    mapping(address => Subscription) public subscriptionsToUser;

    uint256 public constant Basic = 1;
    uint256 public constant Standard = 2;
    uint256 public constant Premium = 3;

    /// @dev Initializes the Netflix contract.
    constructor()
        ERC1155(
            "https://ipfs.io/ipfs/bafybeihjjkwdrxxjnuwevlqtqmh3iegcadc32sio4wmo7bv2gbf34qs34a/{id}.json"
        )
    {}

    /// @notice Allows a user to subscribe to a Netflix subscription.
    /// @param subscriptionType The type of subscription to purchase.
    /// @param subscriptionDuration The duration of the subscription in weeks.
    function subscribe(uint256 subscriptionType, uint256 subscriptionDuration)
        public
    {
        require(
            subscriptionType >= Basic && subscriptionType <= Premium,
            "Invalid subscription type"
        );
        require(
            subscriptionDuration == 4 ||
                subscriptionDuration == 26 ||
                subscriptionDuration == 52,
            "Invalid subscription date"
        );

        Subscription storage subscription = subscriptionsToUser[msg.sender];
        require(subscription.subId == 0, "Already subscribed");

        if (subscriptionType == Basic) {
            setSubscription(subscription, msg.sender, Basic, 1);
        }

        if (subscriptionType == Standard) {
            setSubscription(subscription, msg.sender, Standard, 2);
        }

        if (subscriptionType == Premium) {
            setSubscription(subscription, msg.sender, Premium, 4);
        }

        mint(msg.sender, subscriptionType, 1, "");
        emit SubscriptionPurchased(
            msg.sender,
            subscription.subId,
            subscriptionType,
            subscriptionDuration
        );
    }

    /// @dev Sets the subscription details for a user.
    /// @param subscription The storage reference to the subscription struct.
    /// @param owner The owner of the subscription.
    /// @param subId The subscription ID.
    /// @param maxUsers The maximum number of users allowed for the subscription.
    function setSubscription(
        Subscription storage subscription,
        address owner,
        uint256 subId,
        uint256 maxUsers
    ) internal {
        subscription.subId = subId;
        subscription.owner = owner;
        subscription.maxUsers = maxUsers;
        subscription.expirationDate = block.timestamp + (30 days);
    }

    /// @notice Adds a user to the allowed list for a subscription.
    /// @param user The address of the user to add.
    function addUserToAllowedList(address user) public {
        Subscription storage subscription = subscriptionsToUser[msg.sender];
        require(subscription.subId != 0, "Caller is not subscribed");

        require(
            subscription.usersAllowed.length < subscription.maxUsers,
            "Maximum number of users reached"
        );

        // Check if the user is already in the allowed list
        for (uint256 i = 0; i < subscription.usersAllowed.length; i++) {
            require(
                subscription.usersAllowed[i] != user,
                "User already allowed"
            );
        }

        subscription.usersAllowed.push(user);
        emit UserAddedToAllowedList(msg.sender, subscription.subId, user);
    }

    /// @notice Gets the list of users allowed for a subscription.
    /// @param user The user address.
    /// @return The list of users allowed for the given user address.
    function getUsersAllowed(address user)
        public
        view
        returns (address[] memory)
    {
        return subscriptionsToUser[user].usersAllowed;
    }

    /// @dev Mints new subscription tokens.
    /// @param account The account to receive the tokens.
    /// @param id The token ID.
    /// @param amount The amount of tokens to mint.
    /// @param data Additional data to pass during the minting process.
    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal {
        _mint(account, id, amount, data);
    }

    /// @dev Hook function that is called before any token transfer.
    /// @param operator The address initiating the transfer.
    /// @param from The address transferring the tokens.
    /// @param to The address receiving the tokens.
    /// @param ids The token IDs being transferred.
    /// @param amounts The amounts of tokens being transferred.
    /// @param data Additional data passed during the transfer.
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        if (from != address(0) && to != address(0)) {
            subscriptionsToUser[to] = subscriptionsToUser[from];
            delete subscriptionsToUser[from];
            emit TokenTransferred(from, to, ids[0], amounts[0]);
        }
    }

    /// @notice Sets the base URI for token metadata.
    /// @param newuri The new base URI.
    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    /// @notice Pauses all token transfers.
    function pause() public onlyOwner {
        _pause();
    }

    /// @notice Unpauses token transfers.
    function unpause() public onlyOwner {
        _unpause();
    }
}
