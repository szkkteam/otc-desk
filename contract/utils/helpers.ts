const SimpleOtcMarket = artifacts.require("SimpleOtcMarket");
const ERC20 = artifacts.require("IERC20");
const Router = artifacts.require("IUniswapV2Router02")


const wethWhale = "0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8";
const wethAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const daiAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
//const usdcAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const routerAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";


export const fundWeth = async (to: string, amount: string | number | BN) => {
    const weth = await ERC20.at(wethAddr);
    await weth.transfer(to, amount, {from: wethWhale});
}

export const fundToken = async(to: string, amount: string | BN, token: string) => {
    return buyExactEth(token, to, amount);
}

export const tokenToWei = async(token: string, amount: string) => {
    const contract = await ERC20.at(token);
    return toBN(amount).mul(toBN(10).pow(toBN((await contract.decimals()).toString())));
}

export const buy = async (tokenAddr: string, from: string, amountIn: string | BN | number, amountOut: string | BN | number = 0 ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);
    
    await weth.approve(router.address, amountIn, {from});

    return router.swapExactTokensForTokens(
        amountIn,
        amountOut,
        [weth.address, token.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from}       
    );
}

export const buyEth = async (tokenAddr: string, from: string, amountIn: string | BN , amountOut: string | BN | number = 0 ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);
    

    return router.swapExactETHForTokens(
        amountOut,
        [weth.address, token.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from, value: amountIn}       
    );
}


export const buyExactEth = async (tokenAddr: string, from: string, amountOut: string | BN , amountInMax: string | BN  = toWei('10') ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);
    

    return router.swapETHForExactTokens(
        amountOut,
        [weth.address, token.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from, value: amountInMax}       
    );
}

export const buyExact = async (tokenAddr: string, from: string, amountOut: string | BN | number, amountInMax: string | BN | number = toBN(toWei('10')) ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);
    
    await weth.approve(router.address, await weth.balanceOf(from), {from});

    return router.swapTokensForExactTokens(
        amountOut,
        amountInMax,
        [weth.address, token.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from}       
    );
}

export const sell = async (tokenAddr : string, from: string, amountIn: string | BN | number, amountOut: string | BN | number = 0 ) => {
    const router = await Router.at(routerAddr);
    const weth = await ERC20.at(wethAddr);     
    const token = await ERC20.at(tokenAddr);  
    
    await token.approve(router.address, amountIn, {from});

    return router.swapExactTokensForTokens(
        amountIn,
        amountOut,
        [token.address, weth.address],
        from,
        Date.now() + 1000 * 60 * 1,       
        {from}       
    );
}

export const toWei = (amount: string) => {
    return web3.utils.toWei(amount, 'ether');
}

export const toBN = (amount: string | number) => {
    return web3.utils.toBN(amount);
}
