// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import './interfaces/IOtcPairFactory.sol';
import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2Router02.sol';

contract OtcPairFactory is IOtcPairFactory {

    

    /**
        Lehet nem is kell minden trade-hez külön párt létrehozni, ami új contract. 
        Elég lenne csak itt nyilván tartani egy változóban, ami törölhető index szerint

     */
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));

    struct TradeMeta {
        address maker;
        address tokenOffer;
        address tokenWant;
        uint256 amount;
        uint256 fulfilled;
        uint256 discount;
    }

    TradeMeta[] public allTrades;
    //mapping(address => uint256[]) userTrades;

    constructor() {

    }

     function _safeTransfer(address token, address from, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TRANSFER_FAILED');
    }

    function getallTradesLength() external view returns (uint) {
        return allTrades.length;
    }

    /**
        TODO:
        1) Validáld a basic ötletet, hogy egyáltalán működik e
        2) Nézd meg, hogy a offer és want az minden esetben jó e
        3) Nézd meg, hogy az offer és want ha fel van cserélve, akkor hogy számolja az outputAmountot
        4) Kell egy sima price lekérés függvény, ami discounttal számol
        5) Vedd el a protocol fee-t
        6) Variálható router address (mi van ha a liquidity az sushin van?)
        7) Esetleg fixálni az egyik párt WETH-re?
        8) Nézd meg, hogy a contract tud e fogadni token-t, hogy elrakja a fee-t. Honnan tudjuk, hogy melyikből vegyük a fee-t, ha nincs fixálva?
        9) Hogyan kérjük le a teljes listát?
        10) Kéne timestamp a strukturába, hogy mikor készült
        11) Indikálni kéne, hogy mikor zárult le 1 trade
        # 12) My trades-hez kéne egy map, hogy a userhez mely tradek tartoznak (Ha ez csak reprezentációra kell a frontenden, akkor érdemes egy view pure-t csinálni rá, ami végig iterál)
        13) tokenOffer approválva a create résznél van. Ha valaki közbe vissza vonja az approve-ot, akkor a trader résznél elfog szállni
            lehet, hogy permit-et kéne használni, vagy signature-t? Akkor meg a taker fogja fizetni annak is a gas-t
        14) kell egy cancel trade függvény is, amit csak a maker tud hívni. Hogy reprezentáljuk a canceled makert?
        15) kell egy update trade függvény is, amit csak a maker tud hívni
        16) kell egy trade valid függvény, ami megnézi, hogy még mindig approválva van e a mennyiség és nincs e cancelelve, vagy fullfillelve
        17) kell egy price lekérés függvény, ami a token ratiot megmondja
        18) dust offer protection, kell egy mininmum amount
        19) Oracle lib-be ki lehet mozgatni a uniswap-os részt
        20) kell egy rész, hogy meddig valid az offer

        https://github.com/daifoundation/maker-otc/blob/master/src/simple_market.sol
     */

    function createTrade(address tokenOffer, address tokenWant, uint256 amount, uint256 discount) external returns (uint256 id) {
        IERC20 token = IERC20(tokenOffer);       
        token.approve(address(this), amount);

        TradeMeta memory meta;

        meta.maker = msg.sender;
        meta.tokenOffer = tokenOffer;
        meta.tokenWant = tokenWant;
        meta.amount = amount;
        meta.fulfilled = 0;
        meta.discount = discount;

        allTrades.push(meta);        
        id = allTrades.length - 1;

        //userTrades[msg.sender].push(id);
    }

    function trade(uint256 id, uint256 amount) external returns (bool result) {
        // TODO: Sanity check
        TradeMeta memory meta = allTrades[id];

        require(amount <= meta.amount, "INSUFFICIENT AMOUNT");
        require(meta.fulfilled + amount <= meta.amount, "INSUFFICIENT AMOUNT");

        // Calc input amount for given output amount
        IUniswapV2Router02 uniswapV2Router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

        address[] memory path = new address[](2);
        path[0] = meta.tokenWant;
        path[1] = meta.tokenOffer;
        

        uint[] memory amounts = uniswapV2Router.getAmountsOut(amount, path);
        uint256 amountOut = amounts[1];

        // Apply discount
        IERC20 tokenWant = IERC20(meta.tokenWant);
        tokenWant.approve(address(this), amountOut);

        // Take fee
        _safeTransfer(meta.tokenWant, msg.sender, meta.maker, amountOut);
        _safeTransfer(meta.tokenOffer, meta.maker, msg.sender, amount);

        allTrades[id].fulfilled += amount;
    }
}