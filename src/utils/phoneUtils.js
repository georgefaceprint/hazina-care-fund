export const formatKenyanPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    
    // Handle 07XX or 01XX
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return `+254${cleaned.substring(1)}`;
    }
    // Handle 2547XX or 2541XX
    if (cleaned.startsWith('254') && cleaned.length === 12) {
        return `+${cleaned}`;
    }
    // Handle +2547XX or +2541XX
    if (phone.startsWith('+254')) {
        return phone;
    }
    
    // Return original if it doesn't match expected Kenyan formats
    return phone;
};
