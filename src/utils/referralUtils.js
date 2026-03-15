/**
 * Generates a random alphanumeric referral code of specified length.
 * @param {number} length - Length of the code (default is 6)
 * @returns {string} - Alphanumeric referral code
 */
export const generateReferralCode = (length = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded similar looking chars like I, O, 1, 0
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
/**
 * Generates a random 2-letter agent prefix.
 * @returns {string} - 2-letter prefix
 */
export const generateAgentPrefix = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 2; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
