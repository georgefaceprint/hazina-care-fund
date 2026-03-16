export const formatKenyanPhone = (phone) => {
    if (!phone) return "";
    let cleaned = phone.toString().replace(/\D/g, "");
    
    // Convert to 07... format
    if (cleaned.startsWith("254")) {
        cleaned = cleaned.substring(3);
        // If it was 25407..., after substring it's 07... (good)
        // If it was 2547..., after substring it's 7... (needs 0)
        if (!cleaned.startsWith("0")) {
            cleaned = "0" + cleaned;
        }
    } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
        cleaned = "0" + cleaned;
    }
    
    // Ensure it's 0... format
    if (!cleaned.startsWith("0") && (cleaned.startsWith("7") || cleaned.startsWith("1"))) {
        cleaned = "0" + cleaned;
    }
    
    return cleaned;
};

export const standardizeTo254 = (phone) => {
    if (!phone) return "";
    let cleaned = phone.toString().replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
        cleaned = "254" + cleaned.substring(1);
    } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
        cleaned = "254" + cleaned;
    }
    return cleaned;
};

export const stripPlus = (phone) => {
    if (!phone) return "";
    let s = phone.toString().replace(/^\+/, "");
    if (s.startsWith("254")) s = "0" + s.substring(3);
    return s;
};

export const formatToLocal = (phone) => formatKenyanPhone(phone);
