#import <Foundation/Foundation.h>

@interface SFLManager : NSObject
+ (instancetype)sharedInstance;
- (id)favoriteItems;
@end

@interface SFLItem : NSObject
- (instancetype)initWithName:(NSString *)name URL:(NSURL *)url properties:(NSDictionary *)properties;
- (id)bookmark;
- (NSString *)name;
@end

@interface SFLBookmark : NSObject
- (NSURL *)url;
- (void)resolve;
@end

@interface SFLGenericList : NSObject
- (NSArray<SFLItem *> *)allItems;
- (BOOL)insertItem:(SFLItem *)item atIndex:(NSUInteger)index error:(NSError **)error;
- (BOOL)moveItem:(SFLItem *)item toIndex:(NSUInteger)index error:(NSError **)error;
@end

static NSURL *itemURL(SFLItem *item) {
    id bookmark = item.bookmark;
    if ([bookmark isKindOfClass:NSClassFromString(@"SFLBookmark")]) {
        [bookmark resolve];
        return [bookmark url];
    }
    if (![bookmark isKindOfClass:NSData.class]) {
        return nil;
    }

    return [NSURL URLByResolvingBookmarkData:(NSData *)bookmark
                                     options:NSURLBookmarkResolutionWithoutUI |
                                             NSURLBookmarkResolutionWithoutMounting
                               relativeToURL:nil
                         bookmarkDataIsStale:nil
                                       error:nil];
}

static BOOL itemMatchesURL(SFLItem *item, NSURL *targetURL) {
    NSURL *url = itemURL(item);
    return url != nil && [url.URLByStandardizingPath.path isEqualToString:targetURL.path];
}

static BOOL ensureFavorite(
    SFLGenericList *favorites,
    NSURL *url,
    NSUInteger index,
    BOOL checkOnly,
    NSError **error
) {
    NSArray<SFLItem *> *items = favorites.allItems;
    if (items.count > index && itemMatchesURL(items[index], url)) {
        return YES;
    }
    if (checkOnly) {
        return NO;
    }

    for (SFLItem *item in items) {
        if (itemMatchesURL(item, url)) {
            return [favorites moveItem:item toIndex:index error:error];
        }
    }

    SFLItem *item = [[NSClassFromString(@"SFLItem") alloc]
        initWithName:url.lastPathComponent URL:url properties:nil];
    return [favorites insertItem:item atIndex:index error:error];
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSError *error = nil;
        NSBundle *bundle = [NSBundle bundleWithPath:
            @"/System/Library/Frameworks/CoreServices.framework/Frameworks/SharedFileList.framework"];
        if (![bundle loadAndReturnError:&error]) {
            fprintf(stderr, "Unable to load SharedFileList: %s\n", error.localizedDescription.UTF8String);
            return 1;
        }

        SFLGenericList *favorites = [[NSClassFromString(@"SFLManager") sharedInstance] favoriteItems];
        NSURL *homeURL = [NSURL fileURLWithPath:NSHomeDirectory() isDirectory:YES];
        NSURL *workingURL = [homeURL URLByAppendingPathComponent:@"working" isDirectory:YES];
        BOOL checkOnly = argc == 2 && strcmp(argv[1], "--check") == 0;

        if (argc == 2 && strcmp(argv[1], "--list") == 0) {
            for (SFLItem *item in favorites.allItems) {
                printf("%s\t%s\t%s\n", item.name.UTF8String,
                    NSStringFromClass([item.bookmark class]).UTF8String,
                    itemURL(item).path.UTF8String);
            }
            return 0;
        }

        if (!ensureFavorite(favorites, homeURL, 0, checkOnly, &error)) {
            if (checkOnly) {
                fputs("Home is not the first Finder Favorite.\n", stderr);
                return 1;
            }
            fprintf(stderr, "Unable to keep Home first in Finder Favorites: %s\n",
                error.localizedDescription.UTF8String);
            return 1;
        }
        if (!ensureFavorite(favorites, workingURL, 1, checkOnly, &error)) {
            if (checkOnly) {
                fputs("working is not the second Finder Favorite.\n", stderr);
                return 1;
            }
            fprintf(stderr, "Unable to keep working second in Finder Favorites: %s\n",
                error.localizedDescription.UTF8String);
            return 1;
        }
    }

    return 0;
}
