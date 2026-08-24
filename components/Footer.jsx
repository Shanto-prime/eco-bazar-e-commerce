// components/Footer.jsx   dark site-wide footer. Responsive grid.
import Link from "next/link";
import { getT } from "../lib/i18n/server";

export default async function Footer() {
    const { t } = await getT();

    const linkGroups = [
        {
            title: t("footer.groupMyAccount"),
            links: [
                { href: "/dashboard", label: t("footer.linkMyAccount") },
                {
                    href: "/dashboard/orders",
                    label: t("footer.linkOrderHistory"),
                },
                {
                    href: "/cart",
                    label: t("footer.linkShoppingCart"),
                    strong: true,
                },
                { href: "/wishlist", label: t("footer.linkWishlist") },
            ],
        },
        {
            title: t("footer.groupHelps"),
            links: [
                { href: "/contact", label: t("footer.linkContact") },
                { href: "/faqs", label: t("footer.linkFaqs") },
                { href: "/terms", label: t("footer.linkTerms") },
                { href: "/privacy", label: t("footer.linkPrivacy") },
            ],
        },
        {
            title: t("footer.groupProxy"),
            links: [
                { href: "/about", label: t("footer.linkAbout") },
                { href: "/shop", label: t("footer.linkShop") },
                {
                    href: "/shop/chinese-cabbage",
                    label: t("footer.linkProduct"),
                },
                { href: "/track", label: t("footer.linkTrackOrder") },
            ],
        },
        {
            title: t("footer.groupCategories"),
            links: [
                {
                    href: "/shop?cat=fruit-veg",
                    label: t("footer.linkFruitVeg"),
                },
                {
                    href: "/shop?cat=meat-fish",
                    label: t("footer.linkMeatFish"),
                },
                { href: "/shop?cat=bread", label: t("footer.linkBreadBakery") },
                {
                    href: "/shop?cat=beauty",
                    label: t("footer.linkBeautyHealth"),
                },
            ],
        },
    ];

    return (
        <footer className="bg-eco-footer text-gray-300 pt-10 sm:pt-14 pb-6">
            <div className="max-w-[1320px] mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 sm:col-span-2">
                    <Link href="/" className="flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-seedling text-eco-green text-3xl" />
                        <span className="text-2xl font-bold text-white">
                            Ecobazar
                        </span>
                    </Link>
                    <p className="text-sm mb-4">{t("footer.brandBlurb")}</p>
                    <div className="text-sm">
                        <a className="underline" href="tel:2195550114">
                            +880 01798 697432
                        </a>
                        <span className="mx-2">{t("common.or")}</span>
                        <a
                            className="underline break-all"
                            href="mailto:Proxy@gmail.com"
                        >
                            hello@shanto.dev
                        </a>
                    </div>
                </div>

                {linkGroups.map((g) => (
                    <div key={g.title}>
                        <div className="text-white font-semibold mb-3 sm:mb-4">
                            {g.title}
                        </div>
                        <ul className="space-y-2 text-sm">
                            {g.links.map((l) => (
                                <li key={l.label}>
                                    <Link
                                        href={l.href}
                                        className={`footer-link ${l.strong ? "text-white" : ""}`}
                                    >
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="max-w-[1320px] mx-auto px-4 sm:px-6 mt-8 sm:mt-10 pt-6 border-t border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
                <div>{t("footer.copyright")}</div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    <span className="bg-white text-black px-2 py-1 rounded text-[10px]">
                        {" "}
                        Pay
                    </span>
                    <span className="bg-white text-black px-2 py-1 rounded text-[10px]">
                        VISA
                    </span>
                    <span className="bg-white text-black px-2 py-1 rounded text-[10px]">
                        DISCOVER
                    </span>
                    <span className="bg-white text-black px-2 py-1 rounded text-[10px]">
                        MASTER
                    </span>
                    <span className="bg-white text-black px-2 py-1 rounded text-[10px]">
                        <i className="fa-solid fa-lock" />{" "}
                        {t("footer.securePayment")}
                    </span>
                </div>
            </div>
        </footer>
    );
}
