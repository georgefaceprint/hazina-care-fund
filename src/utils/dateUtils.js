export const getSafeDate = (dateVal) => {
    if (!dateVal) return new Date();
    return typeof dateVal.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
};
