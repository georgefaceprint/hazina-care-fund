export const formatKenyanPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    
    // Standardize to 0... format
    if (cleaned.startsWith('254') && cleaned.length === 12) {
        return `0${cleaned.substring(3)}`;
    }
    if (cleaned.length === 9) {
        return `0${cleaned}`;
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return cleaned;
    }
    
    // Return original if it doesn't match expected Kenyan formats
    return phone;
};

export const standardizeTo254 = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) return `254${cleaned.substring(1)}`;
    if (cleaned.startsWith('254')) return cleaned;
    return cleaned;
};
