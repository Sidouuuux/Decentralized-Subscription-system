// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

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

    constructor()
        ERC1155(
            "https://ipfs.io/ipfs/bafybeihjjkwdrxxjnuwevlqtqmh3iegcadc32sio4wmo7bv2gbf34qs34a/{id}.json"
        )
    {}

    function subscribe(
        uint256 subscriptionType,
        uint256 subscriptionDuration
    ) public {
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
        } else if (subscriptionType == Standard) {
            setSubscription(subscription, msg.sender, Standard, 2);
        } else if (subscriptionType == Premium) {
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

    function getUsersAllowed(
        address user
    ) public view returns (address[] memory) {
        return subscriptionsToUser[user].usersAllowed;
    }

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal {
        _mint(account, id, amount, data);
    }

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

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
