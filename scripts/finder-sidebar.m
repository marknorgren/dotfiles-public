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

static BOOL isHomeItem(SFLItem *item, NSURL *homeURL) {
    NSURL *url = itemURL(item);
    return url != nil && [url.URLByStandardizingPath.path isEqualToString:homeURL.path];
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
        NSArray<SFLItem *> *items = favorites.allItems;
        NSURL *homeURL = [NSURL fileURLWithPath:NSHomeDirectory() isDirectory:YES];
        BOOL checkOnly = argc == 2 && strcmp(argv[1], "--check") == 0;

        if (argc == 2 && strcmp(argv[1], "--list") == 0) {
            for (SFLItem *item in items) {
                printf("%s\t%s\t%s\n", item.name.UTF8String,
                    NSStringFromClass([item.bookmark class]).UTF8String,
                    itemURL(item).path.UTF8String);
            }
            return 0;
        }

        if (items.count > 0 && isHomeItem(items.firstObject, homeURL)) {
            return 0;
        }
        if (checkOnly) {
            fputs("Home is not the first Finder Favorite.\n", stderr);
            return 1;
        }

        for (SFLItem *item in items) {
            if (isHomeItem(item, homeURL)) {
                if (![favorites moveItem:item toIndex:0 error:&error]) {
                    fprintf(stderr, "Unable to move Home in Finder Favorites: %s\n",
                        error.localizedDescription.UTF8String);
                    return 1;
                }
                return 0;
            }
        }

        SFLItem *homeItem = [[NSClassFromString(@"SFLItem") alloc]
            initWithName:homeURL.lastPathComponent URL:homeURL properties:nil];
        if (![favorites insertItem:homeItem atIndex:0 error:&error]) {
            fprintf(stderr, "Unable to add Home to Finder Favorites: %s\n",
                error.localizedDescription.UTF8String);
            return 1;
        }
    }

    return 0;
}
