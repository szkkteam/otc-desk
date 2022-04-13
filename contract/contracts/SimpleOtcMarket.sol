// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import './interfaces/IPriceOracle.sol';


contract SimpleOtcMarket is Ownable, ReentrancyGuard{
    using SafeERC20 for IERC20;

    bytes4 private constant TRANSFER = bytes4(keccak256(bytes('transfer(address,uint)')));
    bytes4 private constant TRANSFER_FROM = bytes4(keccak256(bytes('transferFrom(address,address,uint)')));

    address private _oracleAddress;
    uint256 public lastOfferId;

    struct OfferInfo {
        address tokenOffer;
        address tokenWant;

        address owner;

        uint256 amountOffer;
        int256 discount; // measured in 0.0001 %

        uint64 createdAt;
    }

    mapping (uint256 => OfferInfo) public offers;
    
    event OfferMade(
        bytes32 indexed offerId, 
        address indexed tokenOffer, 
        address indexed tokenWants,
        uint256 amount,
        int256 discount
    );

    /**
        TODO:
        1) Validáld a basic ötletet, hogy egyáltalán működik e
        2) Nézd meg, hogy a offer és want az minden esetben jó e
        3) Nézd meg, hogy az offer és want ha fel van cserélve, akkor hogy számolja az outputAmountot
        # 4) Kell egy sima price lekérés függvény, ami discounttal számol
        5) Vedd el a protocol fee-t
        # 6) Megoldva, oracle library-vel, aminek a címe állítható - Variálható router address (mi van ha a liquidity az sushin van?)
        7) Esetleg fixálni az egyik párt WETH-re?
        8) Nézd meg, hogy a contract tud e fogadni token-t, hogy elrakja a fee-t. Honnan tudjuk, hogy melyikből vegyük a fee-t, ha nincs fixálva?
        # 9) Megoldva azzal, hogy van egy iterátor, amin végig haladva az összes tradet letudjuk kérni - Hogyan kérjük le a teljes listát?
        # 10) Kéne timestamp a strukturába, hogy mikor készült
        # 11) Megoldva azzal, hogy ha teljesült az offer, akkor töröljük a listából - Indikálni kéne, hogy mikor zárult le 1 trade
        # 12) My trades-hez kéne egy map, hogy a userhez mely tradek tartoznak (Ha ez csak reprezentációra kell a frontenden, akkor érdemes egy view pure-t csinálni rá, ami végig iterál)
        13) tokenOffer approválva a create résznél van. Ha valaki közbe vissza vonja az approve-ot, akkor a trader résznél elfog szállni
            lehet, hogy permit-et kéne használni, vagy signature-t? Akkor meg a taker fogja fizetni annak is a gas-t
        # 14) kell egy cancel trade függvény is, amit csak a maker tud hívni. Hogy reprezentáljuk a canceled makert?
        15) kell egy update trade függvény is, amit csak a maker tud hívni
        # 16) Megoldva azzal, hogy van egy isActive függvény, és ha fulfill akkor delete az object - kell egy trade valid függvény, ami megnézi, hogy még mindig approválva van e a mennyiség és nincs e cancelelve, vagy fullfillelve
        17) kell egy price lekérés függvény, ami a token ratiot megmondja
        18) dust offer protection, kell egy mininmum amount
        # 19) Oracle lib-be ki lehet mozgatni a uniswap-os részt
        20) kell egy rész, hogy meddig valid az offer

        https://github.com/daifoundation/maker-otc/blob/master/src/simple_market.sol
     */
    constructor(address oracleAddress) {
        _oracleAddress = oracleAddress;
    }

    modifier canTake(uint256 offerId) {
        require(isActive(offerId), "OFFER CLOSED");
        _;
    }

    modifier canCancel(uint256 offerId) {
        require(isActive(offerId), "OFFER CLOSED");
        require(_msgSender() == getOwner(offerId), "UNAUTHORIZED");
        _;
    }

    function isActive(uint256 offerId) public view returns (bool) {
        return offers[offerId].createdAt > 0;
    }

    function getOwner(uint256 offerId) public view returns (address) {
        return offers[offerId].owner;
    }

    function getOfferId() public view returns (bytes32) {
        return bytes32(lastOfferId);
    }

    function getOffer(uint256 offerId) public view returns (/*address tokenOffer, address tokenWant, uint amountOffer, int discount*/ OfferInfo memory) {
        OfferInfo memory _offer = offers[offerId];
        /*
        tokenOffer = _offer.tokenOffer;
        tokenWant = _offer.tokenWant;
        amountOffer = _offer.amountOffer;
        discount = _offer.discount;
        */
        return _offer;
        //return (_offer.tokenOffer, _offer.tokenWant, _offer.amountOffer, _offer.discount);
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(TRANSFER, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TRANSFER_FAILED');
    }

    function _safeTransferFrom(address token, address from, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(TRANSFER_FROM, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TRANSFER_FROM_FAILED');
    }

    /**
     * Owner functions
     */
    function setOracleAddress(address newOracleAddress) external onlyOwner {
        require(newOracleAddress != address(0));
        require(newOracleAddress != _oracleAddress);

        _oracleAddress = newOracleAddress;
        // TODO: Emit event
    }

    /**
     * Public entry points 
     */
    function offer(address tokenOffer, address tokenWant, uint256 amountOffer, int256 discount) public nonReentrant() returns(bytes32) {
        require(uint128(amountOffer) == amountOffer);
        require(amountOffer > 0, "ZERO AMOUNT");
        require(tokenOffer != address(0));
        require(tokenWant != address(0));
        // TODO: Check discount cannot be less then -99.999%
        address sender = _msgSender();        

        OfferInfo memory _offer;
        _offer.tokenOffer = tokenOffer;
        _offer.tokenWant = tokenWant;
        _offer.amountOffer = amountOffer;
        _offer.discount = discount;
        _offer.owner = sender;
        _offer.createdAt = uint64(block.timestamp);

        lastOfferId += 1;
        offers[lastOfferId] = _offer;

        IERC20(tokenOffer).safeTransferFrom(sender, address(this), amountOffer);

        // TODO: Event
        // TODO: Include the token pari which MUST BE SORTED BY UNISWAP!
        emit OfferMade(bytes32(lastOfferId), tokenOffer, tokenWant, amountOffer, discount);

        return bytes32(lastOfferId);
    }

    function cancel(uint256 offerId) public nonReentrant() canCancel(offerId) returns(bool) {
        OfferInfo memory _offer = offers[offerId];
        delete offers[offerId];

        _safeTransfer(_offer.tokenOffer, _offer.owner, _offer.amountOffer);

        // TODO: Event
        return true;
    }

    function take(uint256 offerId, uint256 amount) public nonReentrant() canTake(offerId) returns (bool) {
        // TODO: Because the market is volatile and during the transaction, the market price can change a lot, introduce slippage

        require(uint128(amount) == amount);
        require(amount > 0, "ZERO AMOUNT");

        OfferInfo memory _offer = offers[offerId];

        require(amount <= _offer.amountOffer, "HIGHER THAN OFFER");
        uint256 amountIn = getAmountInForOffer(offerId, amount);

        address sender = _msgSender();

        offers[offerId].amountOffer -= amount;

        // TODO: Take fee

        IERC20(_offer.tokenWant).safeTransferFrom(sender, _offer.owner, amountIn);
        IERC20(_offer.tokenOffer).safeTransfer(sender, amount);

        // TODO: Emit event
        if (offers[offerId].amountOffer == 0) {
            delete offers[offerId];
            // TODO: Emit event
        }

        return true;
    }

    function getAmountInForOffer(uint256 offerId, uint256 amount) public view canTake(offerId) returns (uint256) {
        OfferInfo memory _offer = offers[offerId];

        uint256 amountIn = IPriceOracle(_oracleAddress).getPriceFor(_offer.tokenOffer, _offer.tokenWant, amount);
        //return (amountIn * uint256(int256(100000) + _offer.discount)) / 100000;
        return amountIn;
    }
    
}