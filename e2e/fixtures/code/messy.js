function fibonacci(n){if(n<2)return n;return fibonacci(n-1)+fibonacci(n-2);}
const memo={};function fastFib(n){if(n in memo)return memo[n];if(n<2)return n;return memo[n]=fastFib(n-1)+fastFib(n-2);}
console.log(fibonacci(10),fastFib(40));
