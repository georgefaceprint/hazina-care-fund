export const formatKenyanPhone = (phone) => {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
        cleaned = "254" + cleaned.substring(1);
    } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
        cleaned = "254" + cleaned;
    }
    return "+" + cleaned;
};
