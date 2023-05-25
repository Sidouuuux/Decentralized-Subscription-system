const { expect } = require("chai");

describe("Netflix", function () {
  let Netflix;
  let netflix;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    Netflix = await ethers.getContractFactory("Netflix");
    netflix = await Netflix.deploy();
    [owner, addr1, addr2] = await ethers.getSigners();
  });

  it("should subscribe to a basic subscription", async function () {
    await netflix.subscribe(1, 4);
    const subscription = await netflix.subscriptionsToUser(owner.address);
    expect(subscription.subId).to.equal(1);
    expect(subscription.maxUsers).to.equal(1);
    // expect(subscription.usersAllowed).to.have.lengthOf(1);
    expect(subscription.owner).to.equal(owner.address);
  });

  it("should add a user to the allowed list", async function () {
    await netflix.subscribe(1, 4);

    // Add addr1 to the allowed list
    await netflix.addUserToAllowedList(addr1.address);

    const usersAllowed = await netflix.getUsersAllowed(owner.address);
    expect(usersAllowed).to.include(addr1.address);
  });

  it("should transfer subscription when NFT is sold", async function () {
    await netflix.subscribe(3, 52);
    await netflix.addUserToAllowedList(addr1.address);
    const tokenId = 3; // Token ID for Premium subscription
    const recipientBalanceBefore = await netflix.balanceOf(addr2.address, tokenId);
    await netflix.safeTransferFrom(owner.address, addr2.address, tokenId, 1, []);
    const recipientBalanceAfter = await netflix.balanceOf(addr2.address, tokenId);
    const subscription = await netflix.subscriptionsToUser(addr2.address);
    const usersAllowed = await netflix.getUsersAllowed(owner.address);

    expect(recipientBalanceBefore).to.equal(0);
    expect(recipientBalanceAfter).to.equal(1);
    expect(subscription.subId).to.equal(3);
    expect(subscription.maxUsers).to.equal(4);
    expect(usersAllowed).to.have.lengthOf(0);
    expect(subscription.expirationDate).to.be.above(0);
  });

  it("should prevent adding more users than the maximum allowed", async function () {
    await netflix.subscribe(2, 26);
    await netflix.addUserToAllowedList(addr1.address);
    await netflix.addUserToAllowedList(addr2.address);
    await expect(
      netflix.addUserToAllowedList(owner.address)
    ).to.be.revertedWith("Maximum number of users reached");
  });

  it("should transfer ownership of the subscription when NFT is sold", async function () {
    await netflix.subscribe(2, 26);
    await netflix.addUserToAllowedList(addr1.address);

    const tokenId = 2; // Token ID for Standard subscription
    await netflix.safeTransferFrom(owner.address, addr2.address, tokenId, 1, []);

    const subscription1 = await netflix.subscriptionsToUser(owner.address);
    expect(subscription1.subId).to.equal(0);
    const usersAllowed = await netflix.getUsersAllowed(owner.address);
    expect(usersAllowed).to.have.lengthOf(0);

    const subscription2 = await netflix.subscriptionsToUser(addr2.address);

    expect(subscription2.subId).to.equal(2);
    expect(usersAllowed).to.have.lengthOf(0);
  });

  it("should prevent transferring NFT when paused", async function () {
    await netflix.subscribe(1, 4);
    await netflix.pause();
    const tokenId = 1; // Token ID for Basic subscription
    await expect(
      netflix.safeTransferFrom(owner.address, addr1.address, tokenId, 1, [])
    ).to.be.revertedWith("Pausable: paused");
  });
  ///////////////////////
  it("should mint the correct NFT when subscribing", async function () {
    await netflix.subscribe(1, 4);
    const balance = await netflix.balanceOf(owner.address, 1);
    expect(balance).to.equal(1);
  });

  it("should clear usersAllowed and expirationDate when transferring subscription", async function () {
    await netflix.subscribe(2, 26);
    await netflix.addUserToAllowedList(addr1.address);
    const tokenId = 2; // Token ID for Standard subscription

    // Verify subscription details before transfer
    const subscriptionBefore = await netflix.subscriptionsToUser(owner.address);
    let usersAllowed = await netflix.getUsersAllowed(owner.address);

    expect(usersAllowed).to.have.lengthOf(1);
    expect(subscriptionBefore.expirationDate).to.be.above(0);
    // Transfer the NFT
    await netflix.safeTransferFrom(owner.address, addr2.address, tokenId, 1, []);

    // Verify subscription details after transfer
    const subscriptionAfter = await netflix.subscriptionsToUser(owner.address);
    usersAllowed = await netflix.getUsersAllowed(owner.address);
    expect(usersAllowed).to.have.lengthOf(0);
    expect(subscriptionAfter.expirationDate).to.equal(0);
  });

  it("should update URI correctly", async function () {
    const newURI = "https://new-ipfs-uri.com/{id}.json";
    await netflix.setURI(newURI);
    const tokenURI = await netflix.uri(1);
    expect(tokenURI).to.equal("https://new-ipfs-uri.com/{id}.json");
  });

  it("should pause and unpause the contract", async function () {
    await netflix.pause();
    expect(await netflix.paused()).to.be.true;

    await netflix.unpause();
    expect(await netflix.paused()).to.be.false;
  });
  /////////////////////////////////
  it("should prevent subscribing to an invalid subscription type", async function () {
    await expect(netflix.subscribe(4, 4)).to.be.revertedWith("Invalid subscription type");
  });

  it("should prevent subscribing with an invalid subscription duration", async function () {
    await expect(netflix.subscribe(1, 10)).to.be.revertedWith("Invalid subscription date");
  });

  it("should prevent subscribing multiple times", async function () {
    await netflix.subscribe(1, 4);
    await expect(netflix.subscribe(2, 26)).to.be.revertedWith("Already subscribed");
  });

  it("should prevent adding the same user multiple times to the allowed list", async function () {
    await netflix.subscribe(2, 26);
    await netflix.addUserToAllowedList(addr1.address);
    await expect(netflix.addUserToAllowedList(addr1.address)).to.be.revertedWith("User already allowed");
  });

  it("should prevent transferring NFT that the caller does not own", async function () {
    await netflix.subscribe(3, 52);
    const tokenId = 3; // Token ID for Premium subscription
    await expect(
      netflix.connect(addr1).safeTransferFrom(owner.address, addr2.address, tokenId, 1, [])
    ).to.be.revertedWith("ERC1155: caller is not token owner or approved");
  });

  it("should prevent transferring non-existent NFT", async function () {
    const tokenId = 1; // Non-existent token ID
    await expect(
      netflix.safeTransferFrom(owner.address, addr1.address, tokenId, 1, [])
    ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
  });
  //////////////////
  it("should prevent transferring NFT when the contract is paused", async function () {
    await netflix.subscribe(1, 4);
    const tokenId = 1; // Token ID for Basic subscription
    await netflix.pause();
    await expect(
      netflix.safeTransferFrom(owner.address, addr1.address, tokenId, 1, [])
    ).to.be.revertedWith("Pausable: paused");
  });

  it("should prevent non-owners from setting the URI", async function () {
    const newURI = "https://new-ipfs-uri.com/{id}.json";
    await expect(
      netflix.connect(addr1).setURI(newURI)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should prevent unauthorized users from adding users to the allowed list", async function () {
    await netflix.subscribe(2, 26);
    await expect(
      netflix.connect(addr1).addUserToAllowedList(addr2.address)
    ).to.be.revertedWith("Caller is not subscribed");
  });

  it("should prevent adding users when the maximum limit is reached", async function () {
    await netflix.subscribe(2, 26);
    await netflix.addUserToAllowedList(addr1.address);
    await netflix.addUserToAllowedList(addr2.address);
    await expect(
      netflix.addUserToAllowedList(owner.address)
    ).to.be.revertedWith("Maximum number of users reached");
  });
  //////////////////
  it("should prevent transferring NFT that exceed the balance", async function () {
    await netflix.subscribe(1, 4);
    const tokenId = 1; // Token ID for Basic subscription
    await expect(
      netflix.safeTransferFrom(owner.address, addr1.address, tokenId, 2, [])
    ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
  });

  it("should prevent transferring NFT to the zero address", async function () {
    await netflix.subscribe(2, 26);
    const tokenId = 2; // Token ID for Standard subscription
    await expect(
      netflix.safeTransferFrom(owner.address, ethers.constants.AddressZero, tokenId, 1, [])
    ).to.be.revertedWith("ERC1155: transfer to the zero address");
  });

  it("should prevent subscribing to the same subscription type before expiration", async function () {
    await netflix.subscribe(3, 52);
    await expect(netflix.subscribe(3, 52)).to.be.revertedWith("Already subscribed");
  });
  it("should emit SubscriptionPurchased event when subscribing", async function () {
    const subscriptionType = 1; // Basic subscription
    const subscriptionDuration = 4; // 4 weeks

    await expect(netflix.subscribe(subscriptionType, subscriptionDuration))
      .to.emit(netflix, "SubscriptionPurchased")
      .withArgs(owner.address, 1, subscriptionType, subscriptionDuration);
  });

  it("should emit UserAddedToAllowedList event when adding a user", async function () {
    const subscriptionType = 1; // Basic subscription
    const subscriptionDuration = 4; // 4 weeks

    await netflix.subscribe(subscriptionType, subscriptionDuration);

    await expect(netflix.addUserToAllowedList(addr1.address))
      .to.emit(netflix, "UserAddedToAllowedList")
      .withArgs(owner.address, 1, addr1.address);
  });
   it("should emit TokenTransferred event when tokens are transferred", async function () {
    // Subscribe to a subscription and mint tokens
    await netflix.connect(addr1).subscribe(1, 4);

    // Get the initial balance of addr1
    const initialBalance = await netflix.balanceOf(addr1.address, 1);

    // Transfer tokens from addr1 to addr2
    const transferTx = await netflix.connect(addr1).safeTransferFrom(
      addr1.address,
      addr2.address,
      1,
      1,
      []
    );

    // Check the emitted event
    await expect(transferTx)
      .to.emit(netflix, "TokenTransferred")
      .withArgs(addr1.address, addr2.address, 1, 1);

    // Get the final balance of addr1
    const finalBalance = await netflix.balanceOf(addr1.address, 1);

    // Assert the balances have been updated correctly
    expect(finalBalance).to.equal(initialBalance - 1);
  });
});
